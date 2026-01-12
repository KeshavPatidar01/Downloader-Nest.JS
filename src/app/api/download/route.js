import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

// Vercel/Next.js config
export const maxDuration = 60; // Max duration for Pro plan
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const body = await req.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({ error: "URL missing" }, { status: 400 });
    }

    console.log(`🎬 Vercel Request for: ${url}`);

    // --- 1. Path & Permissions Setup ---
    
    // Determine where the binary is located in the project
    const originalBinaryPath = path.join(process.cwd(), 'yt-dlp');
    const tmpBinaryPath = '/tmp/yt-dlp';

    // Copy to /tmp if it doesn't exist (Vercel allows execution only in /tmp)
    if (!fs.existsSync(tmpBinaryPath)) {
      if (fs.existsSync(originalBinaryPath)) {
        console.log("Copying binary to /tmp...");
        fs.copyFileSync(originalBinaryPath, tmpBinaryPath);
        fs.chmodSync(tmpBinaryPath, '755'); // Make executable
      } else {
        console.error("❌ Binary not found at project root:", originalBinaryPath);
        return NextResponse.json({ error: "Server Error: yt-dlp binary missing" }, { status: 500 });
      }
    }

    // --- 2. Cookies Setup (Essential for Vercel) ---
    // YouTube blocks server IPs. You should put your Netscape format cookies in .env
    const cookiePath = '/tmp/cookies.txt';
    if (process.env.YOUTUBE_COOKIES) {
      if (!fs.existsSync(cookiePath)) {
        fs.writeFileSync(cookiePath, process.env.YOUTUBE_COOKIES);
      }
    }

    // --- 3. Arguments Setup ---
    const args = [
      url,
      '-o', '-',                 // Output to Stdout
      // Format: "b" means best pre-merged. 
      // Do NOT use "bestvideo+bestaudio" because you don't have FFmpeg on Vercel to merge them.
      '-f', 'b[ext=mp4]', 
      '--no-warnings',
      '--no-check-certificates',
      '--prefer-free-formats',
      '--dns-servers', '8.8.8.8',
      // Spoof User Agent to look like a real browser
      '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    ];

    // Append cookies argument if file exists
    if (fs.existsSync(cookiePath)) {
      args.push('--cookies', cookiePath);
    }

    // --- 4. Stream Creation ---
    const stream = new ReadableStream({
      start(controller) {
        console.log("🚀 Spawning command:", tmpBinaryPath, args.join(' '));
        
        const process = spawn(tmpBinaryPath, args);

        process.stdout.on('data', (chunk) => {
          controller.enqueue(chunk);
        });

        process.stderr.on('data', (data) => {
          const msg = data.toString();
          // Filter out progress bars to keep logs clean
          if (!msg.includes('[download]')) {
             console.log('🔹 yt-dlp log:', msg);
          }
        });

        process.on('close', (code) => {
          console.log("✅ Process finished with code:", code);
          try { controller.close(); } catch (e) {}
        });

        process.on('error', (err) => {
          console.error("❌ Spawn Error:", err);
          try { controller.error(err); } catch(e){}
        });
      }
    });

    // --- 5. Return Response ---
    return new NextResponse(stream, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="video_${Date.now()}.mp4"`,
      },
    });

  } catch (error) {
    console.error("🔥 API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}