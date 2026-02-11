
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

const apiKey = process.env.ALIYUN_API_KEY;

if (!apiKey || apiKey === 'your_aliyun_key') {
    console.error('❌ Error: ALIYUN_API_KEY is not set or is invalid in .env file.');
    process.exit(1);
}

console.log(`🔑 Using API Key: ${apiKey.substring(0, 6)}...******`);

async function testAliyunTTS() {
    const url = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
    
    const payload = {
        model: "qwen3-tts-flash",
        input: {
            text: "这是一个测试脚本，用于验证阿里云 Qwen3-TTS 语音合成服务是否连接正常。",
            voice: "Cherry",
            language_type: "Chinese"
        },
        parameters: {
            format: "mp3",
            rate: 1.0
        }
    };

    console.log('\n🚀 Starting TTS Request...');
    console.log(`   URL: ${url}`);
    console.log(`   Model: ${payload.model}`);
    console.log(`   Text: "${payload.input.text}"`);

    try {
        const startTime = Date.now();
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
                // NOTE: 'X-DashScope-Async': 'enable' is REMOVED intentionally
            },
            body: JSON.stringify(payload)
        });
        const duration = Date.now() - startTime;

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`\n❌ Request Failed! (Status: ${response.status})`);
            console.error(`   Error Message: ${errorText}`);
            return;
        }

        const data = await response.json();
        console.log(`\n✅ Request Successful! (Time: ${duration}ms)`);
        
        // Log full response for debugging
        // console.log('Response Data:', JSON.stringify(data, null, 2));

        // Extract Audio URL
        let audioUrl = '';
        if (data.output && data.output.audio && data.output.audio.url) {
            audioUrl = data.output.audio.url;
        } else if (data.audio && data.audio.url) {
            audioUrl = data.audio.url;
        }

        if (audioUrl) {
            console.log(`\n🎵 Audio URL Generated:`);
            console.log(`   ${audioUrl}`);
            console.log(`\n   (You can open this URL in your browser to listen)`);
        } else {
            console.warn('\n⚠️  Warning: Response structure was successful but Audio URL could not be found.');
            console.log('   Full Response:', JSON.stringify(data, null, 2));
        }

    } catch (error) {
        console.error('\n❌ Network or Execution Error:');
        console.error(error);
    }
}

testAliyunTTS();
