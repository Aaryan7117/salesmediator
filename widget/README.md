# SalesGen Widget SDK

Embed an AI sales agent on any website with one line of code.

## Quick Start

Add this to your website's HTML, before the closing `</body>` tag:

```html
<script src="https://your-api-url/widget/widget.js" data-org="your-org-slug"></script>
```

That's it. The AI sales agent will appear as a chat bubble on your website.

## Attributes

| Attribute | Required | Description |
|-----------|----------|-------------|
| `data-org` | ✅ | Your organisation slug (found in the dashboard) |
| `data-api` | ❌ | API base URL. Defaults to `http://127.0.0.1:8000` |

## Features

- **Zero dependencies** — vanilla JavaScript, no frameworks needed
- **Auto-configuration** — fetches your brand colors, bot name, and greeting from the dashboard
- **Session persistence** — conversations survive page refreshes (localStorage)
- **KB resource cards** — shows relevant documents when the AI finds a match
- **Calendly integration** — shows a booking button when the buyer is ready
- **Typing indicators** — realistic typing animation while the AI thinks
- **Mobile responsive** — works on all screen sizes
- **Scoped styles** — won't conflict with your website's CSS

## Local Development

1. Start the backend: `cd backend && uvicorn main:app --reload`
2. The widget is served at: `http://localhost:8000/widget/widget.js`
3. Test with: `<script src="http://localhost:8000/widget/widget.js" data-org="your-slug" data-api="http://localhost:8000"></script>`
