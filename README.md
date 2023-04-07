# fpgaol-caas-frontend

## How to run the frontend part

First you need to have nodejs >= 16 installed

`echo 'VITE_HOST="http://ip:18888"' > .env.local` for your server address

### Development

```bash
npm install
npm run dev
```

### Production

```bash
npm run build
```

Then serve `dist` dir.
