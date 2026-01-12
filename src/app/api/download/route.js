import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const body = await req.json();
    const { url } = body;

    // Logs store karne ke liye array
    let logs = [];
    const log = (msg) => {
        console.log(msg);
        logs.push(msg);
    };

    log(`🔍 Starting Diagnostic for: ${url}`);

    // 1. Binary Locate karein
    const originalBinaryPath = path.join(process.cwd(), 'yt-dlp');
    const tmpBinaryPath = '/tmp/yt-dlp';

    if (fs.existsSync(originalBinaryPath)) {
        log("✅ Binary found at root.");
        // Copy to /tmp
        if (!fs.existsSync(tmpBinaryPath)) {
            fs.copyFileSync(originalBinaryPath, tmpBinaryPath);
            fs.chmodSync(tmpBinaryPath, '755');
            log("✅ Copied to /tmp and made executable.");
        }
    } else {
        log("❌ Binary NOT FOUND at root. Postinstall script failed?");
        // Folder contents list karein taaki pata chale kya files hain
        const files = fs.readdirSync(process.cwd());
        log(`📂 Root Files: ${files.join(', ')}`);
        return NextResponse.json({ status: 'Failed', logs }, { status: 500 });
    }

    // 2. Cookies Setup
    const cookiePath = '/tmp/cookies.txt';
    if (process.env.YOUTUBE_COOKIES) {
        fs.writeFileSync(cookiePath, process.env.YOUTUBE_COOKIES);
        log(`✅ Cookies written to file. Length: ${process.env.YOUTUBE_COOKIES.length}`);
    } else {
        log("⚠️ No YOUTUBE_COOKIES found in env.");
    }

    // 3. Command Test (Dry Run)
    // Hum video download nahi karenge, bas info nikalenge taaki error dikhe
    const args = [
        url,
        '--dump-json', // Sirf info nikalo
        '--no-warnings',
        '--no-check-certificates',
    ];

    if (fs.existsSync(cookiePath)) {
        args.push('--cookies', cookiePath);
    }

    log(`🚀 Running: ${tmpBinaryPath} ${args.join(' ')}`);

    return new Promise((resolve) => {
        const process = spawn(tmpBinaryPath, args);

        let outputData = "";
        let errorData = "";

        process.stdout.on('data', (data) => {
            outputData += data.toString();
        });

        process.stderr.on('data', (data) => {
            errorData += data.toString();
            log(`🔴 STDERR: ${data.toString()}`);
        });

        process.on('close', (code) => {
            log(`🏁 Process finished with code: ${code}`);
            
            if (code === 0) {
                // Success!
                resolve(NextResponse.json({ 
                    status: 'Success', 
                    message: 'Setup is Correct! The tool can read the video info.',
                    videoTitle: JSON.parse(outputData).title,
                    logs 
                }));
            } else {
                // Failure
                resolve(NextResponse.json({ 
                    status: 'Error', 
                    message: 'yt-dlp failed to run.', 
                    exitCode: code,
                    errorDetails: errorData, // Ye sabse important hai
                    logs 
                }, { status: 500 }));
            }
        });
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}