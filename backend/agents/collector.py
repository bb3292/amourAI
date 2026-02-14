"""
Collector Agent – fetches and parses public web sources, PDFs, and internet research.
Routes LLM calls through Blaxel model gateway (if configured) or direct Anthropic.
"""
import io
import json
import re
import logging
import urllib.parse
from typing import List, Dict, Tuple

import httpx
from bs4 import BeautifulSoup
from pypdf import PdfReader

from integrations.model_gateway import get_model_gateway

logger = logging.getLogger(__name__)

# ── URL type detection ───────────────────────────────────────
SOURCE_PATTERNS = {
    "reddit": [r"reddit\.com", r"old\.reddit\.com"],
    "g2": [r"g2\.com"],
    "capterra": [r"capterra\.com"],
    "trustpilot": [r"trustpilot\.com"],
    "forum": [r"community\.", r"forum\.", r"discuss\."],
    "blog": [r"blog\.", r"/blog/"],
    "pricing": [r"/pricing", r"/plans"],
}


def detect_source_type(url: str) -> str:
    url_lower = url.lower()
    for source_type, patterns in SOURCE_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, url_lower):
                return source_type
    return "web"


class CollectorAgent:
    """Fetches, parses, and chunks text from public URLs, PDFs, or raw text."""

    CHUNK_SIZE = 800  # tokens ~= words * 1.3
    CHUNK_OVERLAP = 100

    # Realistic browser headers to avoid 403
    HEADERS = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/122.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "DNT": "1",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Cache-Control": "max-age=0",
    }

    # ── URL Fetching ──────────────────────────────────────────

    async def fetch_url(self, url: str) -> Tuple[str, str]:
        """Fetch a URL and return (text_content, source_type). Handles HTML and PDF."""
        source_type = detect_source_type(url)
        try:
            async with httpx.AsyncClient(
                timeout=30.0,
                follow_redirects=True,
                headers=self.HEADERS,
                http2=False,
            ) as client:
                resp = await client.get(url)
                resp.raise_for_status()

                content_type = resp.headers.get("content-type", "").lower()

                # Handle PDF URLs
                if "application/pdf" in content_type or url.lower().endswith(".pdf"):
                    text, stype = self.extract_pdf(resp.content, filename=url.split("/")[-1] or "remote.pdf")
                    if not text or len(text.strip()) < 50:
                        raise ValueError(f"No meaningful content extracted from PDF at {url}")
                    return text, stype

                html = resp.text

        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error fetching {url}: {e.response.status_code}")
            raise ValueError(f"HTTP {e.response.status_code} fetching {url}")
        except httpx.RequestError as e:
            logger.error(f"Request error fetching {url}: {e}")
            raise ValueError(f"Could not reach {url}: {str(e)}")

        text = self._extract_text(html, source_type)
        if not text or len(text.strip()) < 50:
            raise ValueError(f"No meaningful content extracted from {url}")
        return text, source_type

    # ── HTML Text Extraction ─────────────────────────────────

    def _extract_text(self, html: str, source_type: str) -> str:
        """Parse HTML and extract meaningful text based on source type."""
        soup = BeautifulSoup(html, "html.parser")

        # Remove non-content elements
        for tag in soup(["script", "style", "nav", "footer", "header", "aside", "noscript", "svg", "img", "iframe"]):
            tag.decompose()

        if source_type == "reddit":
            return self._extract_reddit(soup)
        elif source_type in ("g2", "capterra", "trustpilot"):
            return self._extract_reviews(soup)
        else:
            return self._extract_generic(soup)

    def _extract_reddit(self, soup: BeautifulSoup) -> str:
        """Extract Reddit post and comments."""
        parts = []
        title = soup.find("h1")
        if title:
            parts.append(f"Title: {title.get_text(strip=True)}")

        for div in soup.find_all(["div", "p", "span"], class_=re.compile(
            r"(md|RichTextJSON|Comment|usertext-body|entry)", re.I
        )):
            text = div.get_text(separator=" ", strip=True)
            if len(text) > 20:
                parts.append(text)

        if not parts:
            parts = [p.get_text(strip=True) for p in soup.find_all("p") if len(p.get_text(strip=True)) > 20]

        return "\n\n".join(parts[:100])

    def _extract_reviews(self, soup: BeautifulSoup) -> str:
        """Extract review content from G2, Capterra, etc."""
        parts = []
        for review in soup.find_all(class_=re.compile(r"(review|testimonial|feedback)", re.I)):
            text = review.get_text(separator=" ", strip=True)
            if len(text) > 30:
                parts.append(text)

        if not parts:
            parts = [p.get_text(strip=True) for p in soup.find_all("p") if len(p.get_text(strip=True)) > 30]

        return "\n\n".join(parts[:80])

    def _extract_generic(self, soup: BeautifulSoup) -> str:
        """Generic text extraction."""
        main = soup.find("main") or soup.find("article") or soup.find("body")
        if main:
            text = main.get_text(separator="\n", strip=True)
        else:
            text = soup.get_text(separator="\n", strip=True)

        lines = [line.strip() for line in text.split("\n") if line.strip()]
        return "\n".join(lines[:300])

    # ── Text Chunking ────────────────────────────────────────

    def chunk_text(self, text: str) -> List[str]:
        """Split text into overlapping chunks for processing."""
        words = text.split()
        if len(words) <= self.CHUNK_SIZE:
            return [text]

        chunks = []
        start = 0
        while start < len(words):
            end = start + self.CHUNK_SIZE
            chunk = " ".join(words[start:end])
            chunks.append(chunk)
            start = end - self.CHUNK_OVERLAP
            if start >= len(words):
                break

        return chunks

    # ── PDF Extraction ───────────────────────────────────────

    def extract_pdf(self, file_bytes: bytes, filename: str = "upload.pdf") -> Tuple[str, str]:
        """Extract text from a PDF file (bytes). Returns (text, source_type)."""
        try:
            reader = PdfReader(io.BytesIO(file_bytes))
        except Exception as e:
            raise ValueError(f"Could not read PDF '{filename}': {str(e)}")

        if len(reader.pages) == 0:
            raise ValueError(f"PDF '{filename}' has no pages")

        parts = []
        for i, page in enumerate(reader.pages):
            text = page.extract_text()
            if text and text.strip():
                parts.append(f"--- Page {i + 1} ---\n{text.strip()}")

        if not parts:
            raise ValueError(f"No extractable text found in PDF '{filename}'. It may be image-based (scanned).")

        full_text = "\n\n".join(parts)

        # Truncate very large PDFs
        if len(full_text) > 50000:
            logger.warning(f"PDF '{filename}' truncated from {len(full_text)} to 50000 chars")
            full_text = full_text[:50000] + "\n\n[... truncated ...]"

        return full_text, "pdf"

    # ── Internet Research ────────────────────────────────────

    async def research_competitor(
        self, competitor_name: str, sector: str = "", num_results: int = 8
    ) -> List[Dict[str, str]]:
        """
        Research a competitor by:
        1. Asking Claude for specific, publicly accessible URLs about this company
        2. Constructing known review/comparison page URLs
        Returns a list of {title, url, snippet} results.
        """
        results = []
        seen_urls = set()

        # Strategy 1: Known review/comparison site URL patterns
        known_urls = self._build_known_urls(competitor_name, sector)
        for entry in known_urls:
            if entry["url"] not in seen_urls:
                seen_urls.add(entry["url"])
                results.append(entry)

        # Strategy 2: Ask Claude for high-value research URLs
        try:
            ai_urls = await self._ask_claude_for_urls(competitor_name, sector)
            for entry in ai_urls:
                if entry["url"] not in seen_urls:
                    seen_urls.add(entry["url"])
                    results.append(entry)
        except Exception as e:
            logger.warning(f"Claude URL discovery failed: {e}")

        logger.info(
            f"Research for '{competitor_name}': {len(results)} candidate URLs generated"
        )
        return results[:num_results]

    def _build_known_urls(self, name: str, sector: str) -> List[Dict[str, str]]:
        """Build URLs from known review/comparison sites."""
        slug = name.lower().replace(" ", "-").replace(".", "")
        entries = []

        # Company's own website
        for domain_guess in [f"www.{slug}.com", f"{slug}.com"]:
            entries.append({
                "title": f"{name} — Official Website",
                "url": f"https://{domain_guess}",
                "snippet": f"Official website for {name}",
            })

        # TrustRadius (usually accessible)
        entries.append({
            "title": f"{name} Reviews - TrustRadius",
            "url": f"https://www.trustradius.com/products/{slug}/reviews",
            "snippet": f"User reviews and ratings for {name}",
        })

        # PeerSpot (formerly IT Central Station)
        entries.append({
            "title": f"{name} Reviews - PeerSpot",
            "url": f"https://www.peerspot.com/products/{slug}-reviews",
            "snippet": f"Enterprise reviews for {name}",
        })

        # Reddit search
        entries.append({
            "title": f"Reddit discussions about {name}",
            "url": f"https://old.reddit.com/search/?q={urllib.parse.quote(name)}&sort=relevance&t=year",
            "snippet": f"Reddit posts about {name} from the past year",
        })

        # News/blog sources
        entries.append({
            "title": f"{name} - TechCrunch",
            "url": f"https://techcrunch.com/tag/{slug}/",
            "snippet": f"TechCrunch articles about {name}",
        })

        return entries

    async def _ask_claude_for_urls(self, name: str, sector: str) -> List[Dict[str, str]]:
        """Ask LLM (via Blaxel/Anthropic gateway) to suggest specific, publicly accessible URLs."""
        gateway = get_model_gateway()

        prompt = f"""I need to research the company "{name}" (sector: {sector or 'unknown'}) for competitive intelligence.

Suggest 6-8 specific, real, publicly accessible URLs where I can find:
- Customer reviews, complaints, and feedback
- Product comparisons and alternatives
- Pricing information and criticism
- Recent news about problems or changes
- Technical documentation or status pages

For each URL, provide:
- "title": brief description
- "url": the full URL (must be real, publicly accessible pages — no paywalled or login-required content)
- "snippet": what competitive intelligence I can find there

Return ONLY a JSON array. URLs must be specific, real pages (not search result pages). Prefer:
- TrustRadius, PeerSpot, AlternativeTo, StackShare, ProductHunt
- Official status/changelog pages
- Reddit threads (use old.reddit.com for reliability)
- Blog comparison posts from known tech blogs
- Company's own pricing and feature pages"""

        try:
            text = await gateway.chat(prompt, max_tokens=2048)
            start = text.find("[")
            end = text.rfind("]") + 1
            if start >= 0 and end > start:
                urls = json.loads(text[start:end])
                # Validate each entry
                valid = []
                for u in urls:
                    if isinstance(u, dict) and u.get("url", "").startswith("http"):
                        valid.append({
                            "title": u.get("title", ""),
                            "url": u["url"],
                            "snippet": u.get("snippet", ""),
                        })
                return valid
            return []
        except Exception as e:
            logger.error(f"LLM URL discovery failed: {e}")
            return []

    async def fetch_research_results(
        self, results: List[Dict[str, str]], max_fetch: int = 8
    ) -> List[Tuple[str, str, str]]:
        """
        Fetch the top research URLs and extract text.
        Returns list of (text, source_type, url).
        Skips URLs that fail (403, timeout, etc.) and continues.
        """
        fetched = []
        for result in results[:max_fetch]:
            url = result["url"]
            try:
                text, stype = await self.fetch_url(url)
                fetched.append((text, stype, url))
                logger.info(f"Successfully fetched research URL: {url} ({len(text)} chars)")
            except Exception as e:
                logger.warning(f"Could not fetch research result {url}: {e}")
                # Use the snippet as a lightweight fallback source
                snippet = result.get("snippet", "")
                if snippet and len(snippet) > 30:
                    fetched.append((
                        f"Title: {result.get('title', '')}\nURL: {url}\n\n{snippet}",
                        "web_snippet",
                        url,
                    ))
        logger.info(f"Fetched {len(fetched)} of {min(max_fetch, len(results))} research URLs")
        return fetched

    # ── Raw Text + PII ───────────────────────────────────────

    def parse_raw_text(self, text: str) -> Tuple[str, str]:
        """Handle raw text input (manual paste)."""
        cleaned = text.strip()
        if len(cleaned) < 20:
            raise ValueError("Text too short to extract meaningful insights (minimum 20 characters)")
        return cleaned, "manual"

    def redact_pii(self, text: str) -> str:
        """Basic PII redaction: emails, phone numbers, SSNs."""
        # Email
        text = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '[EMAIL_REDACTED]', text)
        # Phone (various formats)
        text = re.sub(r'\b(\+?1?[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b', '[PHONE_REDACTED]', text)
        # SSN-like
        text = re.sub(r'\b\d{3}-\d{2}-\d{4}\b', '[SSN_REDACTED]', text)
        return text
