import requests
import pandas as pd
from datetime import datetime
import os
import sys

# Scraper.py - Pulls data from Knowby API and saves to CSV files for dashboard usage.

def main():
    try:
        # Import API keys/IDs from keys.py
        from keys import AUTHORIZATION, X_MEMBER_ID, X_ORGANISATION_ID
        
        # Make sure output folders exist, create necessary directories for storing CSV files
        public_dir = "public"
        os.makedirs(public_dir, exist_ok=True)
        
        # HTTP Headers required for API authentication and requests
        headers = {
            "Authorization": AUTHORIZATION,
            "X-Member-Id": X_MEMBER_ID,
            "X-Organisation-Id": X_ORGANISATION_ID,
            "User-Agent": "Mozilla/5.0",
            "Origin": "https://knowby.pro",
            "Referer": "https://knowby.pro/",
            "Accept": "*/*",
            "Content-Type": "application/json",
        }

        # Fetch published knowbys from the API
        # Currently only gets the most recent 24 knowbys sorted by last updated date
        url_published = f"https://knowby-pro-backend-prod-qt5p6426oq-ts.a.run.app/api/knowby/published/{X_ORGANISATION_ID}?skip=0&take=24&sort=last_updated_at_utc&ascending=false&query="
        response_published = requests.post(url_published, headers=headers)
        
        # Check if the API request was successful
        if response_published.status_code != 200:
            return False
            
        # Parse the JSON response and extract the collection of knowbys
        data_published = response_published.json()
        collection_published = data_published.get("collection", [])
        
        # Exit if no published knowbys were found
        if not collection_published:
            return False
            
        # Create a clean DataFrame with only needed columns
        df_published_clean = pd.DataFrame(collection_published)[
            ["id", "title", "created_by_member_name", "visibility", "estimated_time_in_seconds", "last_updated_at_utc"]
        ]

        # Store all raw views + completions in lists
        all_views = []
        all_completions = []

        # Base URLs for fetching views and completions data
        base_view_url = "https://knowby-pro-backend-prod-qt5p6426oq-ts.a.run.app/api/knowbyview/latest/"
        base_completion_url = "https://knowby-pro-backend-prod-qt5p6426oq-ts.a.run.app/api/knowbycompletion/latest/"
        params = "?skip=0&take=25"  # Get up to 25 records per knowby

        # Loop through each knowby to fetch its views and completions
        for _, row in df_published_clean.iterrows():
            instruction_id = row["id"]
            title = row["title"]
            
            # Fetch the latest views data for this knowby
            url_views = f"{base_view_url}{instruction_id}{params}"
            res_views = requests.get(url_views, headers=headers)
            if res_views.status_code == 200:
                views_data = res_views.json().get("collection", [])
                for view in views_data:
                    view["instruction"] = title  # Add knowby title for context
                    all_views.append(view)
            
            # Fetch completions data for this knowby
            url_completions = f"{base_completion_url}{instruction_id}{params}"
            res_completions = requests.get(url_completions, headers=headers)
            if res_completions.status_code == 200:
                completions_data = res_completions.json().get("collection", [])
                for completion in completions_data:
                    completion["instruction"] = title  # Add the knowby title for context
                    all_completions.append(completion)

        # Helper function to convert Unix timestamps to dates (DD/MM/YYYY format)
        def convert_timestamp_to_date(timestamp):
            try:
                dt = datetime.fromtimestamp(timestamp)
                return dt.strftime('%d/%m/%Y')
            except:
                return ""

        # Save views data to CSV file
        if all_views:
            df_views = pd.DataFrame(all_views)
            # Transform data to desired format for the dashboard
            df_views_transformed = pd.DataFrame({
                'knowby_id': df_views['knowby_id'],
                'knowby_name': df_views['instruction'],
                'member_id': df_views['member_id'],
                'member_name': df_views['member_name'],
                'date': df_views['timestamp_utc'].apply(convert_timestamp_to_date)
            })
            views_path = os.path.join(public_dir, "scraperviews.csv")
            df_views_transformed.to_csv(views_path, index=False)

        # Save completions data to CSV file
        if all_completions:
            df_completions = pd.DataFrame(all_completions)
            # Transform data to desired format for the dashboard
            df_completions_transformed = pd.DataFrame({
                'knowby_id': df_completions['knowby_id'],
                'knowby_name': df_completions['instruction'],
                'member_id': df_completions['member_id'],
                'member_name': df_completions['member_name'],
                'date': df_completions['timestamp_utc'].apply(convert_timestamp_to_date)
            })
            completions_path = os.path.join(public_dir, "scrapercompletions.csv")
            df_completions_transformed.to_csv(completions_path, index=False)

        # Create enhanced knowbys CSV with views and last viewed data, since published url does not come with it.
        if len(df_published_clean) > 0 and all_views:
            df_views_agg = pd.DataFrame(all_views)
            if not df_views_agg.empty:
                # Group views by knowby_id to calculate total views and last viewed timestamp
                views_summary = df_views_agg.groupby('knowby_id').agg({
                    'timestamp_utc': ['count', 'max']  # count = total views, max = last viewed
                }).reset_index()
                
                # Flatten the column names from the groupby operation
                views_summary.columns = ['knowby_id', 'total_views', 'last_viewed_timestamp']
                views_summary['last_viewed'] = views_summary['last_viewed_timestamp'].apply(convert_timestamp_to_date)
                
                # Merge views summary with published knowbys data
                df_enhanced = df_published_clean.merge(
                    views_summary[['knowby_id', 'total_views', 'last_viewed']], 
                    left_on='id', 
                    right_on='knowby_id', 
                    how='left'
                )
                
                # Fill NaN values with 0 for knowbys that have no views
                df_enhanced['total_views'] = df_enhanced['total_views'].fillna(0).astype(int)
                df_enhanced['last_viewed'] = df_enhanced['last_viewed'].fillna('')
                
                # Create final CSV in exact format needed for the dashboard
                df_final = pd.DataFrame({
                    'knowby_id': df_enhanced['id'],
                    'title': df_enhanced['title'],
                    'description': '',  # Placeholder for description field
                    'created_at': df_enhanced['last_updated_at_utc'].apply(convert_timestamp_to_date),
                    'created_by_member_id': df_enhanced['created_by_member_name'],
                    'member_name': df_enhanced['created_by_member_name'],
                    'status': 'Published',  # All knowbys from this endpoint are published
                    'visibility': df_enhanced['visibility'],
                    'views': df_enhanced['total_views'],
                    'last_viewed': df_enhanced['last_viewed']
                })
                
                # Save enhanced knowbys CSV with view statistics
                enhanced_path = os.path.join(public_dir, "scraperpublished.csv")
                df_final.to_csv(enhanced_path, index=False)

        # Return True to show successful completion
        return True
        
    except Exception as e:
        # Return False if any error occurred during scraping
        return False

# Entry point: run the main function and exit with appropriate code
if __name__ == "__main__":
    success = main()
    if not success:
        sys.exit(1)  # Exit with error code 1 if scraping failed
    else:
        sys.exit(0)  # Exit with success code 0 if scraping completed