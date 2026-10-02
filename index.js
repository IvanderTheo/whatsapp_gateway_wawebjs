require('dotenv').config();

const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const app = express();

app.use(express.json());
const API_KEY = process.env.API_KEY;
const PORT = Number(process.env.PORT ?? 3000);

const authenticate = (req, res, next) => {
    const apiKey = req.header('X-API-Key');

    if (!apiKey || apiKey !== API_KEY) {
        return res.status(401).json({
            message: 'Unauthorized.',
        });
    }

    next();
};

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './.wwebjs_auth',
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
        ],
    },
});

let whatsappReady = false;

client.on('qr', (qr) => {
    console.log('Scan QR Code berikut dengan WhatsApp:');
    qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => {
    console.log('WhatsApp authenticated.');
});

client.on('ready', () => {
    whatsappReady = true;

    console.log('WhatsApp client is ready.');
});

client.on('auth_failure', (message) => {
    whatsappReady = false;

    console.error('Authentication failure:', message);
});

client.on('disconnected', (reason) => {
    whatsappReady = false;

    console.log('WhatsApp disconnected:', reason);
});

client.on('message_ack', (message, ack) => {
    console.log('Message ACK:', {
        id: message.id?._serialized,
        ack,
    });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        whatsapp: whatsappReady ? 'ready' : 'not_ready',
    });
});

app.post('/api/messages', authenticate, async (req, res) => {
    const { phone, message } = req.body;

    if (!phone || !message) {
        return res.status(422).json({
            message: 'phone and message are required.',
        });
    }

    if (!whatsappReady) {
        return res.status(503).json({
            message: 'WhatsApp client is not ready.',
        });
    }

    try {
        const chatId = `${phone}@c.us`;

        await client.sendMessage(
            chatId,
            message,
        );

        return res.status(200).json({
            success: true,
            message: 'Message sent.',
        });
    } catch (error) {
        console.error('Failed to send message:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to send message.',
        });
    }
});

client.initialize().catch((error) => {
    console.error('Initialization failed:', error);
});

app.listen(PORT, () => {
    console.log(`WhatsApp Gateway listening on port ${PORT}`);
});
client.on('loading_screen', (percent, message) => {
    console.log('Loading:', percent, message);
});

client.on('change_state', (state) => {
    console.log('WhatsApp state:', state);
});

client.on('disconnected', (reason) => {
    whatsappReady = false;
    console.log('WhatsApp disconnected:', reason);
});