const express = require('express');
const axios = require('axios');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const BYL_API_URL = 'https://api.byl.mn/v1'; 
const PRODUCT_PRICE = 49900;

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

app.post('/api/create-invoice', async (req, res) => {
    const { email } = req.body;
    
    const invoiceData = {
        projectId: parseInt(process.env.BYL_PROJECT_ID), // Тоо болгож хувиргасан
        amount: PRODUCT_PRICE,
        description: "Pro Key - Дээд зэрэглэлийн дижитал түлхүүр",
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
        // АЛДААГ БАРИЖ АВААД ШУУД ВЭБСАЙТ РУУ ИЛГЭЭХ
        const errorDetail = error.response ? error.response.data : error.message;
        console.error("API Error:", errorDetail);
        
        res.status(500).json({ 
            error: "Byl API алдаа: " + JSON.stringify(errorDetail) 
        });
    }
});

app.post('/api/qpay-callback', async (req, res) => {
    const paymentData = req.body; 
    
    if (paymentData.status === 'PAID') {
        const userEmail = paymentData.metadata.customer_email;
        const generatedKey = `PROKEY-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: userEmail,
            subject: 'Таны худалдан авсан эрх - Pro Key',
            text: `Баярлалаа! Таны төлбөр амжилттай баталгаажлаа.\n\nТаны худалдаж авсан эрх/түлхүүр: ${generatedKey}\n\nPro Key`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) console.log("Имэйл алдаа:", error);
        });
    }

    res.status(200).send("OK");
});

module.exports = app;
