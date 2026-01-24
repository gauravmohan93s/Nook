# Nook Roadmap & Ideas

## AI & Intelligence Features (Tier-Based)

### Seeker (Free)
- **Basic Summaries:** Simple 3-bullet point summaries using cheaper models (Gemini Flash).
- **Keyword Extraction:** Extract top 5 keywords from articles.

### Scholar (Mid-Tier)
- **Deep Dive Summaries:** Detailed breakdown of arguments, methodology, and conclusions.
- **Q&A Chat:** "Chat with this article" feature using RAG (Retrieval Augmented Generation).
- **Related Research:** AI-suggested related papers from OpenAlex/Semantic Scholar based on the current reading.
- **Flashcards:** Auto-generate quiz flashcards from the article for study.

### Insider (Pro-Tier)
- **Cross-Article Synthesis:** Select 5 articles and ask AI to "Compare and contrast these viewpoints" or "Synthesize a new essay based on these sources".
- **Audio Podcasts:** Convert articles into a 2-person conversational podcast (like NotebookLM).
- **Translation:** High-quality translation of academic papers into native language.
- **Workflow Automation:** "If I save an article, automatically generate a summary and email it to me."

## Performance Optimization (Automatic Testing)

To programmatically check for slow processes:
1.  **Load Testing Script:** Create a Python script using `locust` or `requests` to hit endpoints concurrently.
2.  **APM (Application Performance Monitoring):** Integrate **Sentry** or **Prometheus** (free tiers available) to visualize bottlenecks in real-time.
3.  **Database Indexing:** Analyze slow queries (like the ones you provided) and add indexes to frequently filtered columns (e.g., `content_cache.url`, `usage_logs.user_id`).

## Security & Compliance
- **HTML Sanitization:** Enforce server-side and client-side HTML sanitization to prevent XSS.
- **SSRF Protection:** Block private IP ranges and unsafe schemes for URL fetches.
- **CORS Hardening:** Restrict API origins to trusted frontend domains.
- **Secrets Hygiene:** Remove committed secrets, rotate keys, and enforce env-only config.
- **CSP & Security Headers:** Apply CSP, Referrer-Policy, and Permissions-Policy.

## Observability & Tracking
- **Structured Logs:** JSON logs with request IDs and response timing.
- **Error Tracking:** Add Sentry for backend + frontend.
- **Metrics:** Add Prometheus/OpenTelemetry for latency, error rate, and usage.
- **Business Events:** Track unlocks, summarizes, saves, and payments.
- **Tiered Models:** Route premium tiers to higher-quality models to preserve UX.

## UX & Visual Polish
- **Typography System:** Distinct serif/sans pairing and improved hierarchy.
- **Landing Page:** Refined color system and stronger CTAs.
- **Reader Mode:** Safer HTML rendering + clearer emphasis cues.

## Current Priorities
- [x] Fix Medium Image Proxying.
- [x] Enable RLS for Security.
- [x] Implement 3-Tier Pricing.
- [x] Add HTML sanitization + SSRF protection.
- [x] Add request ID logging + log rotation.
- [x] Add Sentry hooks + Prometheus /metrics endpoint.
- [x] Preserve freedium mirror images via `.main-content` parsing.
- [ ] Build "Chat with Article" MVP.
- [ ] Add metrics dashboards (Grafana/hosted).
- [ ] Resolve frontend dev Tailwind module resolution issues.
