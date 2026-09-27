const express = require('express');
const axios = require('axios');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// API хаягийг зассан хэсэг
const BYL_API_URL = 'https://byl.mn/api/v1'; 
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
    
    // Project ID-г тусад нь хувьсагчид авах
    const projectId = process.env.BYL_PROJECT_ID; 

    // Byl.mn рүү явуулах датаны бүтэц
    const invoiceData = {
        amount: PRODUCT_PRICE,
        description: "Pro Key - Дээд зэрэглэлийн дижитал түлхүүр",
        metadata: { customer_email: email }
    };

    try {
        // ЗӨВШӨӨРӨГДСӨН ЗӨВ ХАЯГ РУУ ХАНДАХ:
        const response = await axios.post(`${BYL_API_URL}/projects/${projectId}/invoices`, invoiceData, {
            headers: { 
                'Authorization': `Bearer ${process.env.BYL_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        // Хэрэв амжилттай болбол Фронтенд рүү датаг буцаах
        res.json(response.data);
    } catch (error) {
        // Алдаа гарвал дэлгэцэнд харуулах
        const errorDetail = error.response ? error.response.data : error.message;
        console.error("API Error:", errorDetail);
        
        res.status(500).json({ 
            error: "Byl API алдаа: " + JSON.stringify(errorDetail) 
        });
    }
});

app.post('/api/qpay-callback', async (req, res) => {
    const paymentData = req.body; 
    
    // Төлбөрийн төлөв 'paid' эсвэл 'complete' болсон эсэхийг шалгах
    if (paymentData.status === 'paid' || paymentData.status === 'complete') {
        const userEmail = paymentData.metadata?.customer_email || paymentData.customer_email;
        const generatedKey = `PROKEY-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

        if (userEmail) {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: userEmail,
                subject: 'Таны худалдан авсан эрх - Pro Key',
                text: `Баярлалаа! Таны төлбөр амжилттай баталгаажлаа.\n\nТаны худалдаж авсан эрх/түлхүүр: ${generatedKey}\n\nPro Key`
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) console.log("Имэйл алдаа:", error);
                else console.log("Имэйл амжилттай илгээгдлээ.");
            });
        }
    }

    // Byl-д заавал OK буцаах ёстой
    res.status(200).send("OK");
});

module.exports = app;
