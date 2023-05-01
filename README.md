## fpgaol-caas-frontend

#### Try it out!

[](https://caas.symbioticeda.com)

[](http://149.28.136.195:18888)

#### Development

Nodejs >= 16 needed.

```bash
npm install
npm run dev
```

Prettier

```bash
npx prettier --write .
```

Configuration -- `.env` and/or `.env.local`

`VITE_HOST`: access point to the backend. Write `https://xxx` if server's using HTTPS.

`VITE_VERSION`: Set to `symbioticeda` for the main site config, and `regymm` for development/personal config.

#### Deployment

```bash
npm run build
```

Then serve `dist/`. Override the `page/` directory in [fpgaol-caas-backend](https://github.com/FPGAOL-CE/fpgaol-caas-backend) with the contents of `dist/` and serve frontend/backend together.
