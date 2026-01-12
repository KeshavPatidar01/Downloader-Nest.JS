/** @type {import('next').NextConfig} */
const nextConfig = {
  // Aapka purana setting (isse hatana nahi hai)
  reactCompiler: true,

  // 👇 Ye naya "Magic Setting" hai
  experimental: {
    // Ye Vercel ko force karega ki wo 'yt-dlp' file ko
    // API routes ke saath bundle kare, warna wo file ko chhod deta hai.
    outputFileTracingIncludes: {
      '/api/**/*': ['./yt-dlp'],
    },
  },
};

export default nextConfig;

