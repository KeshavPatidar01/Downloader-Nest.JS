import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path'; // ✅ IMPORT ZAROORI HAI

export async function POST(req) {
  try {
    const body = await req.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({ error: "URL missing" }, { status: 400 });
    }

    console.log(`🎬 Vercel Downloading: ${url}`);

    // ✅ IMPORTANT: Vercel par 'yt-dlp' global nahi hota.
    // Humne jo 'postinstall' mein download kiya, wo root folder mein hota hai.
    // Isliye hum uska full path banayenge:
    const command = path.join(process.cwd(), 'yt-dlp');

    // ✅ Streaming ke liye Sahi Settings
    const args = [
      url,
      '-o', '-',                   // Stdout par output
      '-f', 'best[ext=mp4]/best',  // Best MP4 format (Audio+Video Combined)
      '--no-warnings',             // Clean Output
      '--no-check-certificates'    // Errors kam karne ke liye
    ];

    const stream = new ReadableStream({
      start(controller) {
        // Process Spawn karo (Correct Path ke sath)
        const process = spawn(command, args);

        // 1. DATA HANDLING
        process.stdout.on('data', (chunk) => {
          try {
             controller.enqueue(chunk);
          } catch (error) {
             // Controller closed
          }
        });

        // 2. END OF STREAM
        process.stdout.on('end', () => {
            try {
                controller.close();
            } catch (error) {}
        });

        // 3. LOGS (Debugging ke liye)
        process.stderr.on('data', (data) => {
          const msg = data.toString();
          if (!msg.includes('[download]')) { 
             console.log('yt-dlp log:', msg);
          }
        });

        // 4. PROCESS CLOSE
        process.on('close', (code) => {
           console.log("Process finished with code:", code);
        });

        process.on('error', (err) => {
            console.error("Spawn Error:", err);
            try { controller.error(err); } catch(e){}
        });
      }
    });

    const filename = `video_${Date.now()}.mp4`;

    return new NextResponse(stream, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}