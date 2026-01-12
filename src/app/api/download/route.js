import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

// Vercel par kabhi kabhi timeout issue hota hai, isliye hum stream use kar rahe hain
export const maxDuration = 60; // Pro plan ke liye (Free me 10s hi rahega)
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const body = await req.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({ error: "URL missing" }, { status: 400 });
    }

    console.log(`🎬 Vercel Request for: ${url}`);

    // 1. Path Setup
    // Note: Vercel par file root me hoti hai, par execute /tmp se karna safe hai
    const originalBinaryPath = path.join(process.cwd(), 'yt-dlp');
    
    // Check agar binary exist karti hai
    if (!fs.existsSync(originalBinaryPath)) {
        console.error("❌ Binary not found at:", originalBinaryPath);
        return NextResponse.json({ error: "yt-dlp binary missing on server" }, { status: 500 });
    }

    // 2. Permission Fix (Copy to /tmp to ensure executable permissions)
    // Vercel ka root folder Read-Only hota hai, isliye hum /tmp use karenge
    const tmpBinaryPath = '/tmp/yt-dlp';
    
    try {
        // Agar /tmp me nahi hai to copy karo
        if (!fs.existsSync(tmpBinaryPath)) {
            fs.copyFileSync(originalBinaryPath, tmpBinaryPath);
        }
        // Permission set karo (755 = Read+Write+Execute)
        fs.chmodSync(tmpBinaryPath, '755');
    } catch (e) {
        console.error("⚠️ Permission/Copy Error (Using original path as fallback):", e);
    }

    // Final command path decide karo (prefer /tmp, fallback to root)
    const command = fs.existsSync(tmpBinaryPath) ? tmpBinaryPath : originalBinaryPath;

    // 3. Arguments Setup (No FFmpeg required)
    const args = [
      url,
      '-o', '-',                        // Output to Stdout (Stream)
      '-f', 'best[height<=720][ext=mp4]', // 720p MP4 (Audio+Video pre-merged)
      '--no-warnings',
      '--no-check-certificates',
      '--prefer-free-formats',
      '--dns-servers', '8.8.8.8'        // Google DNS to avoid blocking
    ];

    // 4. Stream Create Karna
    const stream = new ReadableStream({
      start(controller) {
        console.log("🚀 Spawning command:", command, args);
        
        const process = spawn(command, args);

        process.stdout.on('data', (chunk) => {
          controller.enqueue(chunk);
        });

        process.stderr.on('data', (data) => {
          const msg = data.toString();
          // Debugging ke liye stderr print karo
          console.log('🔹 yt-dlp log:', msg);
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

    // 5. Response Return Karna
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