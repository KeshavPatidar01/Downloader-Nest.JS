import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs'; // ✅ Permissions ke liye fs chahiye

export async function POST(req) {
  try {
    const body = await req.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({ error: "URL missing" }, { status: 400 });
    }

    console.log(`🎬 Vercel Request for: ${url}`);

    // 1. Path Setup
    const command = path.join(process.cwd(), 'yt-dlp');

    // 2. ✅ CRITICAL FIX: Check if binary exists & Give Permissions
    if (fs.existsSync(command)) {
        try {
            fs.chmodSync(command, '755'); // Executable permission set karein
        } catch (e) {
            console.error("Permission Error:", e);
        }
    } else {
        return NextResponse.json({ error: "yt-dlp binary not found on server" }, { status: 500 });
    }

    // 3. ✅ Format Fix for Vercel (No FFmpeg)
    // 'best' often requires merging audio/video which needs FFmpeg.
    // Use 'best[height<=720]' to get pre-merged MP4 files (Safe for Vercel).
    const args = [
      url,
      '-o', '-',                 // Stdout output
      '-f', 'best[height<=720][ext=mp4]', // ✅ Safer format (720p pre-merged)
      '--no-warnings',
      '--no-check-certificates',
      '--prefer-free-formats',
      '--dns-servers', '8.8.8.8' // Kabhi kabhi Vercel IP block hoti hai
    ];

    const stream = new ReadableStream({
      start(controller) {
        console.log("Spawn command:", command, args);
        
        const process = spawn(command, args);

        process.stdout.on('data', (chunk) => {
          controller.enqueue(chunk);
        });

        process.stdout.on('end', () => {
             try { controller.close(); } catch (e) {}
        });

        process.stderr.on('data', (data) => {
          const msg = data.toString();
          // Error logs ko ignore na karein, unhe print karein
          console.log('yt-dlp stderr:', msg);
        });

        process.on('close', (code) => {
           console.log("Process finished with code:", code);
           if (code !== 0) {
               // Agar code 0 nahi hai, matlab error aaya tha
               // Lekin stream start ho chuki hoti hai, isliye hum yahan 
               // sirf log hi kar sakte hain.
               console.error("Download failed inside stream");
           }
        });

        process.on('error', (err) => {
            console.error("Spawn Error:", err);
            try { controller.error(err); } catch(e){}
        });
      }
    });

    return new NextResponse(stream, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="video_${Date.now()}.mp4"`,
      },
    });

  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}





