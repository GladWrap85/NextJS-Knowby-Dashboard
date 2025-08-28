import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';

// API route to run scraper.py
export async function POST(request: NextRequest): Promise<Response> {
  try {
    // Run the scaper.py script using child_process.spawn()
    // This opens a separate process to execute the script
    const pythonProcess = spawn('python', ['python-scripts/scraper.py'], {
      cwd: process.cwd(), // Use current working directory
      stdio: ['pipe', 'pipe', 'pipe'] // Capture stdin, stdout, and stderr
    });
    
    // Wait for the scraper to finish running before sending a response
    return new Promise((resolve) => {
      // When the Python script finishes, we check the exit code
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          // Exit code 0 means everything worked
          resolve(NextResponse.json({
            success: true,
            message: 'Scraper completed successfully'
          }));
        } else {
          // Any other exit code means an error occurred
          resolve(NextResponse.json({
            success: false,
            message: 'Scraper failed'
          }, { status: 500 }));
        }
      });
      
      // Set a timeout to prevent the scraper from running indefinitely
      // If scraper takes longer than 5 minutes, kill it and return timeout error
      setTimeout(() => {
        pythonProcess.kill(); // Terminate Python process
        resolve(NextResponse.json({
          success: false,
          message: 'Scraper timed out'
        }, { status: 408 }));
      }, 5 * 60 * 1000); // 5 minute timeout
    });
    
  } catch (error) {
    // If there was error starting Python process
    // Return error response to frontend
    return NextResponse.json({
      success: false,
      message: 'Failed to start scraper'
    }, { status: 500 });
  }
}
