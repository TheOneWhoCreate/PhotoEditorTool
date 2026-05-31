const express = require('express');
const cors = require('cors');
require('dotenv').config(); // Automatically parses credentials hidden inside .env variables

const app = express();

// 1. Middleware configurations
app.use(cors()); // Permits your static frontend to query this backend instance safely
app.use(express.json()); // Parses incoming JSON payloads automatically

// 2. Base Health Check Route (Verifies Render service connection stability)
app.get('/', (req, res) => {
    res.status(200).send("Photo Editor Backend Gateway operational.");
});

// 3. Secured Gemini Proxy Route
app.post('/api/gemini-proxy', async (req, res) => {
    try {
        // Your private API Key is read directly out of server memory space safely
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ error: "Server error: Gemini configurations missing." });
        }

        const { userPrompt } = req.body; // Extract instructions or image data sent from your frontend

        /* TODO: Your future Gemini API call logic will be pasted here.
           Your static frontend won't ever see the key, it will only talk to this route!
        */

        // Placeholder response back to your client-side workspace
        return res.status(200).json({
            success: true,
            message: "Successfully received prompt securely through backend middleware!",
            receivedPrompt: userPrompt
        });

    } catch (error) {
        console.error("Backend Error:", error);
        return res.status(500).json({ error: "Internal Gateway Processing failure." });
    }
});

// 4. Fallback execution port selection (Render sets process.env.PORT automatically)
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Backend service bound safely to communication pipeline port: ${PORT}`);
});