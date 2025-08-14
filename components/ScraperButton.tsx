'use client'

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckCircle, AlertCircle, Play } from 'lucide-react';

export default function ScraperButton() {
  // State to track if the scraper is currently running
  const [isRunning, setIsRunning] = useState(false);
  
  // State to track current status: idle, running, completed, or error
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');

  // Calls the API route to trigger scraper.py
  const runScraper = async () => {
    setIsRunning(true);
    setStatus('running');

    try {
      // Send POST request to API route made before
      const response = await fetch('/api/run-scraper', {
        method: 'POST',
      });

      // Parse response from API
      const result = await response.json();

      if (result.success) {
        // If scraper completed successfully, update status
        setStatus('completed');
        
        // Refresh page after 2 seconds to show new data from updated CSV files
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        // If scraper failed, update status to error
        setStatus('error');
      }
    } catch (error) {
      // If there was a network error, update status to error
      setStatus('error');
    } finally {
      // Always reset the running state when done
      setIsRunning(false);
    }
  };

  // Function to get the appropriate icon based on current status
  const getButtonIcon = () => {
    switch (status) {
      case 'running':
        return <RefreshCw className="h-4 w-4 animate-spin" />; // Spinning refresh icon
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />; // Green checkmark
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />; // Red alert icon
      default:
        return <Play className="h-4 w-4" />; // Play icon for idle state
    }
  };

  // Function to get the appropriate button text based on the status
  const getButtonText = () => {
    switch (status) {
      case 'running':
        return 'Running...';
      case 'completed':
        return 'Completed!';
      case 'error':
        return 'Failed';
      default:
        return 'Run Scraper';
    }
  };

  // Function to get the appropriate button styling based on current status
  const getButtonVariant = () => {
    switch (status) {
      case 'completed':
        return 'default'; // Default styling for success
      case 'error':
        return 'destructive'; // Red styling for error
      default:
        return 'outline'; // Outline styling for idle/running
    }
  };

  return (
    <Button
      onClick={runScraper}
      disabled={isRunning} // Disable button while scraper is running
      variant={getButtonVariant()}
      className="flex items-center gap-2"
    >
      {getButtonIcon()}
      {getButtonText()}
    </Button>
  );
}
