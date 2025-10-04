// API route to extract authentication headers from Knowby.co
// This opens a browser window and captures the required headers for web scraping

import { NextRequest, NextResponse } from 'next/server'
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

export async function POST(request: NextRequest) {
  // Browser instance to be cleaned up in finally block
  let browser: any = null
  
  try {
    console.log('Starting header extraction...')
    
     // Launch browser and create new page
    browser = await chromium.launch({
      headless: false  // Show browser window for user interaction
    })
    
    // Create a new page in the browser
    const page = await browser.newPage()
    

    // Variables to store extracted headers and track extraction status
    let extractedHeaders: any = null
    let gotHeaders = false
    
    // Listen for all network requests to capture authentication headers
    // This is the core mechanism for extracting the required headers
    page.on('request', (request: any) => {
      const headers = request.headers()
      
      // Check if we haven't captured headers yet and if this request has all required headers
      if (!gotHeaders && 
          headers.authorization && 
          headers['x-member-id'] && 
          headers['x-organisation-id']) {
        
        // Extract and store the authentication headers
        extractedHeaders = {
          AUTHORIZATION: headers.authorization,
          X_MEMBER_ID: headers['x-member-id'],
          X_ORGANISATION_ID: headers['x-organisation-id']
        }
        gotHeaders = true
        
        console.log('Headers captured successfully')
      }
    })
    
    // Navigate to Knowby and wait for user login
    console.log('Navigating to Knowby...')
    await page.goto('https://knowby.pro/', { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    })
    
    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Wait for user to log in and capture headers
    console.log('Waiting for authentication...')
    const maxWaitTime = 5 * 60 * 1000 // 5 minutes
    const startTime = Date.now()
    
    while (!gotHeaders && (Date.now() - startTime) < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    // Process captured headers and save to files
    if (gotHeaders && extractedHeaders) {
      
      // Save headers to keys.py for web scraper compatibility
      const keysPath = path.join(process.cwd(), 'python-scripts', 'keys.py')
      const keysContent = 
      `AUTHORIZATION = "${extractedHeaders.AUTHORIZATION}"
X_MEMBER_ID = "${extractedHeaders.X_MEMBER_ID}"
X_ORGANISATION_ID = "${extractedHeaders.X_ORGANISATION_ID}"
`
      console.log(keysContent)
      
      fs.writeFileSync(keysPath, keysContent)
      console.log('Headers saved to keys.py for web scraper compatibility')
      
      // Return success response
      return NextResponse.json({
        success: true,
        message: 'Headers extracted and saved successfully',
        headers: extractedHeaders,
        lastUpdated: new Date().toISOString()
      })
      
    } else {
      // Return error if headers not captured
      return NextResponse.json({
        success: false,
        error: 'Failed to capture headers',
        details: 'No authentication headers were detected. Please make sure you are logged into Knowby.'
      }, { status: 500 })
    }
    
  } catch (error) {
    // Handle any errors that occurred
    console.error('Header extraction error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to extract headers',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
    
  } finally {
    // Clean up browser resources
    if (browser) {
      await browser.close()
    }
  }
}
