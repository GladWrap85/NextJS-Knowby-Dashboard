import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';

// Force this API route to run in the Node.js runtime (not Edge),
// since we need to spawn a Python process.
export const runtime = 'nodejs';

export async function POST(_req: NextRequest): Promise<Response> {

  try {
    // Run scraper.py using child_process.spawn()
    // This launches a separate Python process.
    const pythonProcess = spawn('python', ['python-scripts/scraper.py'], {
      cwd: process.cwd(), // Run from project root
      stdio: ['pipe', 'pipe', 'pipe'], // Capture stdin, stdout, and stderr
    });

    // Optional: log output for debugging
    pythonProcess.stdout?.on('data', (d) =>
      console.log('[scraper stdout]', d.toString()),
    );
    pythonProcess.stderr?.on('data', (d) =>
      console.error('[scraper stderr]', d.toString()),
    );

    const TIMEOUT_MS = 5 * 60 * 1000; // 5-minute timeout

    // Wrap process execution in a Promise<Response>
    return await new Promise<Response>((resolve) => {
      // Timeout handler to prevent scraper running indefinitely
      const timeout = setTimeout(() => {
        pythonProcess.kill(); // Kill Python process if too slow
        resolve(
          NextResponse.json(
            { success: false, message: 'Scraper timed out' },
            { status: 408 },
          ),
        );
      }, TIMEOUT_MS);

      // Listen for scraper process to finish
      pythonProcess.on('close', (code) => {
        clearTimeout(timeout); // Cancel timeout when process exits
        if (code === 0) {
          // Exit code 0 = success
          resolve(
            NextResponse.json({
              success: true,
              message: 'Scraper completed successfully',
            }),
          );
        } else {
          // Non-zero exit code = failure
          resolve(
            NextResponse.json(
              { success: false, message: 'Scraper failed' },
              { status: 500 },
            ),
          );
        }
      });
    });
  } catch (err) {
    // Error starting the Python process
    console.error('Failed to start scraper:', err);
    return NextResponse.json(
      { success: false, message: 'Failed to start scraper' },
      { status: 500 },
    );
  }
}
