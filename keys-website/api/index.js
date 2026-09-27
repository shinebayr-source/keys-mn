const express = require('express');
const axios = require('axios');
const nodemailer = require('nodemailer');
const cors = require('cors');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const app = express();
app.use(express.json());
app.use(cors());

const BYL_API_URL = 'https://byl.mn/api/v1'; 
const PRODUCT_PRICE = 49900;

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD }
});

// Vercel KV Функцүүд (Frontend polling-д зориулагдсан)
async function kvSet(key, value) {
    if(!process.env.KV_REST_API_URL) return;
    await axios.post(`${process.env.KV_REST_API_URL}/set/${key}/${encodeURIComponent(value)}`, {}, {
        headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` }
    });
}
async function kvGet(key) {
    if(!process.env.KV_REST_API_URL) return null;
    try {
        const res = await axios.get(`${process.env.KV_REST_API_URL}/get/${key}`, {
            headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` }
        });
        return decodeURIComponent(res.data.result);
    } catch(e) { return null; }
}

app.post('/api/create-invoice', async (req, res) => {
    const { email } = req.body;
    try {
        const response = await axios.post(`${BYL_API_URL}/projects/${process.env.BYL_PROJECT_ID}/invoices`, {
            amount: PRODUCT_PRICE,
            description: "Google AI Pro - 18 сар",
            metadata: { customer_email: email }
        }, {
            headers: { 'Authorization': `Bearer ${process.env.BYL_TOKEN}` }
        });
        res.json(response.data);
    } catch (error) { res.status(500).json({ error: "Byl API алдаа" }); }
});

app.get('/api/check-status', async (req, res) => {
    const { email } = req.query;
    if(!email) return res.json({ status: 'pending' });
    const status = await kvGet(`payment_${email}`);
    const assignedLink = await kvGet(`link_${email}`);
    if (status === 'paid') res.json({ status: 'paid', link: assignedLink });
    else res.json({ status: 'pending' });
});

app.post('/api/qpay-callback', async (req, res) => {
    const paymentData = req.body; 
    
    if (paymentData.status === 'paid' || paymentData.status === 'complete') {
        const userEmail = paymentData.metadata?.customer_email || paymentData.customer_email;
        
        if (userEmail) {
            let assignedLink = "Линк дууссан байна. Админтай холбогдоно уу.";
            
            // GOOGLE SHEET-ЭЭС ЛИНК СУГАЛАХ ПРОЦЕСС
            if(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
                try {
                    const auth = new JWT({
                        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                        key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), // Private key-г унших
                        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
                    });
                    
                    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);
                    await doc.loadInfo();
                    const sheet = doc.sheetsByIndex[0];
                    const rows = await sheet.getRows();

                    for (let row of rows) {
                        // A баганыг 'Link', B баганыг 'Status' гэж толгой (header) өгсөн байна гэж үзнэ
                        if (row.get('Link') && !row.get('Status')) {
                            assignedLink = row.get('Link');
                            row.assign({ 'Status': userEmail }); // B баганад имэйлийг нь бичнэ
                            await row.save();
                            break; // Олдсон тул зогсоно
                        }
                    }
                } catch(e) {
                    console.error("Google Sheet алдаа:", e);
                }
            }

            // Төлөвийг KV-д хадгалах
            await kvSet(`payment_${userEmail}`, 'paid');
            await kvSet(`link_${userEmail}`, assignedLink);

            // Имэйлээр явуулах
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: userEmail,
                subject: 'Таны Google AI Pro эрх',
                text: `Баярлалаа! Таны худалдан авалт амжилттай.\n\nТаны идэвхжүүлэх линк: ${assignedLink}\n\nGoogle хаягаараа нэвтэрч орж идэвхжүүлээрэй.`
            };
            transporter.sendMail(mailOptions, (e, i) => {});
        }
    }
    res.status(200).send("OK");
});

module.exports = app;
