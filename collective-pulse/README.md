# Collective Pulse


## Control

| Input                              | Response                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------- |
| Left Arrow                         | YES — move up by 5 at the next one-second sample                          |
| Right Arrow                        | NO — move down by 5 at the next one-second sample                         |
| `FIT` button or F key              | Fit the current day's elapsed timeline into the graph                     |
| `LIVE` button or L key             | Return to the scrolling live view                                         |
| `−` / `+`                          | Zoom out or in                                                            |


## Run locally

Use Node.js **22.12 or later**. Install dependencies and build the React app before starting the installation:

```powershell
npm ci
npm run build
npm start
```
```
  $env:PORT = "8000"
```
## Private remote management with Tailscale

```powershell
tailscale serve --bg http://127.0.0.1:8000
tailscale serve status
```

