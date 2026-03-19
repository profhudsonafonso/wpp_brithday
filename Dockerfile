FROM node:20

#instalar dependencias de transformaçãod e audio

WORKDIR /app

RUN apt-get update && apt-get install -y \
chromium \
ffmpeg \
libnss3 \
libatk-bridge2.0-0 \
libx11-xcb1 \
libxcomposite1 \
libxdamage1 \
libxrandr2 \
libgbm1 \
libasound2 \
libpangocairo-1.0-0 \
libatk1.0-0 \
libgtk-3-0 \
libxss1 \
libxtst6 \
fonts-liberation \
libappindicator3-1 \
libdrm2 \
libxfixes3 \
libxcb1 \
libxext6 \
libx11-6


# instalar dependências do chromium
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-driver \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libnspr4 \
    libnss3 \
    libxss1 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libgbm1 \
    xdg-utils \
    wget \
    --no-install-recommends

WORKDIR /app

COPY app/package.json .

RUN npm install

COPY app .

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

EXPOSE 3000

CMD ["node", "server.js"]
