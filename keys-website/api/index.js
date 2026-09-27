const express = require('express');
const axios = require('axios');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Byl.mn болон бусад тохиргоо (Vercel-ийн тохиргооноос автоматаар уншина)
const BYL_API_URL = 'https://api.byl.mn/v1'; 
const PRODUCT_PRICE = 50000;

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,       // Имэйл хаяг
        pass: process.env.EMAIL_PASSWORD    // Gmail app password
    }
});

// Нэхэмжлэх үүсгэх API
app.post('/api/create-invoice', async (req, res) => {
    const { email } = req.body;
    
    const invoiceData = {
        projectId: process.env.BYL_PROJECT_ID,
        amount: PRODUCT_PRICE,
        description: "KEYS.MN - Онцгой эрх / Түлхүүр",
        metadata: { customer_email: email }
    };

    try {
        const response = await axios.post(`${BYL_API_URL}/invoices`, invoiceData, {
            headers: { 
                'Authorization': `Bearer ${process.env.BYL_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: "Нэхэмжлэх үүсгэх боломжгүй байна" });
    }
});

// Webhook хүлээж авах API
app.post('/api/qpay-callback', async (req, res) => {
    const paymentData = req.body; 
    
    if (paymentData.status === 'PAID') {
        const userEmail = paymentData.metadata.customer_email;
        const generatedKey = `KEYS-MN-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: userEmail,
            subject: 'Таны худалдан авсан эрх - KEYS.MN',
            text: `Баярлалаа! Таны төлбөр амжилттай баталгаажлаа.\n\nТаны худалдаж авсан эрх/түлхүүр: ${generatedKey}\n\nKEYS.MN`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) console.log("Имэйл алдаа:", error);
        });
    }

    res.status(200).send("OK");
});

// Vercel-д зориулсан export
module.exports = app;