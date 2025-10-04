import requests
import pandas as pd
from datetime import datetime
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
import time

# -------------------------------
# Scraper.py - Pulls data from Knowby API and saves CSVs
# -------------------------------
def main():
    try:
        # Import API keys/IDs from keys.py
        from keys import AUTHORIZATION, X_MEMBER_ID, X_ORGANISATION_ID

        # Ensure output folder exists
        public_dir = "public"
        os.makedirs(public_dir, exist_ok=True)

        # HTTP Headers required for API authentication
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

        # -------------------------------
        # Fetch published knowbys
        # -------------------------------
        url_published = (
            f"https://knowby-pro-backend-prod-qt5p6426oq-ts.a.run.app/api/knowby/published/"
            f"{X_ORGANISATION_ID}?skip=0&take=24&sort=last_updated_at_utc&ascending=false&query="
        )
        response_published = requests.post(url_published, headers=headers)
        # Initialise empty DataFrame to ensure df_published_clean always exists
        # Prevents "undefined variable" errors later in the code if API calls fail
        df_published_clean = pd.DataFrame()
        
        # Check if published knowbys API call was successful
        if response_published.status_code != 200:
            print("Failed to fetch published knowbys")
            # Continue with empty DataFrame to allow
            # completions and views to still be processed successfully
        else:
            data_published = response_published.json()
            collection_published = data_published.get("collection", [])
            
            if not collection_published:
                print("No published knowbys found")
                # Keep df_published_clean as empty DataFrame - don't exit early
            else:
                df_published_clean = pd.DataFrame(collection_published)[
                    ["id", "title", "created_by_member_name", "visibility", "estimated_time_in_seconds", "last_updated_at_utc"]
                ]

        # -------------------------------
        # Fetch views per knowby (parallel)
        # -------------------------------
        all_views = []
        base_view_url = "https://knowby-pro-backend-prod-qt5p6426oq-ts.a.run.app/api/knowbyview/latest/"
        params = "?skip=0&take=25"

        def fetch_views(row):
            instruction_id = row["id"]
            title = row["title"]
            url_views = f"{base_view_url}{instruction_id}{params}"
            result = []
            try:
                res_views = requests.get(url_views, headers=headers)
                if res_views.status_code == 200:
                    views_data = res_views.json().get("collection", [])
                    for view in views_data:
                        view["instruction"] = title
                        result.append(view)
            except Exception as e:
                print(f"Error fetching views for {title}: {e}")
            return result

        # Only attempt to fetch views if we successfully retrieved published knowbys
        # This prevents errors when df_published_clean is empty due to API failures
        if not df_published_clean.empty:
            # Use parallel processing to fetch views for all knowbys simultaneously
            # This is much faster than fetching them one by one sequentially  
            with ThreadPoolExecutor(max_workers=10) as executor:
                # Submit a fetch_views task for each published knowby
                view_futures = [executor.submit(fetch_views, row) for _, row in df_published_clean.iterrows()]
                # Collect results as they complete and add to all_views list
                for future in as_completed(view_futures):
                    all_views.extend(future.result())

        # -------------------------------
        # Fetch completions (org-wide) with pagination
        # This uses a different API endpoint than published knowbys above
        # This endpoint was updated when Knowby changed their completion URL structure
        # -------------------------------
        
        # Set up time window for completions data (from when Knowby was created)
        end_ts = int(time.time())                    # Current timestamp (now)
        # January 1st, 2023 00:00:00 UTC 
        start_ts = int(datetime(2023, 1, 1).timestamp())
        # This fetches all completions since Knowby's inception
        
        # Pagination parameters for the completions API
        take = 25                                    # Number of records to fetch per request
        skip = 0                                     # Number of records to skip (starts at 0)
        all_completions = []                         # List to store all completion records

        # Use pagination loop to fetch ALL completion records
        # API only returns 25 records at a time, so we need to make multiple requests
        while True:
            completion_url = (
                f"https://knowby-pro-backend-prod-571132428963.australia-southeast1.run.app"
                f"/api/reports/organisation/completions/{X_ORGANISATION_ID}/{start_ts}/{end_ts}/{skip}/{take}/Pacific%2FAuckland"
            )
            try:
                # Make GET request to the completions API endpoint
                res = requests.get(completion_url, headers=headers)
                if res.status_code != 200:
                    print(f"Error fetching completions: {res.status_code}")
                    break  # Exit pagination loop on API error

                data = res.json()
                records = data.get("table", {}).get("collection", [])
                
                # If no records returned, we've reached the end of all data
                if not records:
                    break  # Exit pagination loop - no more completions to fetch

                all_completions.extend(records)
                
                # Move to next page by incrementing skip counter
                # Next request will skip records just fetched
                skip += take  # e.g., skip=0→25→50→75... (25 records per page)

            except Exception as e:
                print(f"Exception fetching completions: {e}")
                break

        # -------------------------------
        # Helper functions: convert UTC timestamps to readable formats
        # -------------------------------
        def convert_timestamp_to_date(timestamp):
            """Convert Unix timestamp to date string in DD/MM/YYYY format"""
            try:
                dt = datetime.fromtimestamp(timestamp)
                return dt.strftime('%d/%m/%Y')
            except:
                return ""

        def convert_timestamp_to_time(timestamp):
            """Convert Unix timestamp to time string in HH:MM:SS format (24-hour)"""
            try:
                dt = datetime.fromtimestamp(timestamp)
                return dt.strftime('%H:%M:%S')
            except:
                return ""

        # -------------------------------
        # Save views CSV
        # -------------------------------
        if all_views:
            df_views = pd.DataFrame(all_views)
            df_views_transformed = pd.DataFrame({
                'knowby_id': df_views['knowby_id'],
                'knowby_name': df_views['instruction'],
                'member_id': df_views['member_id'],
                'member_name': df_views['member_name'],
                'date': df_views['timestamp_utc'].apply(convert_timestamp_to_date),
                'time': df_views['timestamp_utc'].apply(convert_timestamp_to_time)
            })
            df_views_transformed.to_csv(os.path.join(public_dir, "scraperviews.csv"), index=False)

        # -------------------------------
        # Save completions CSV
        # -------------------------------
        if all_completions:
            df_completions = pd.DataFrame(all_completions)
            df_completions_transformed = pd.DataFrame({
                'knowby_id': df_completions['knowby_id'],
                'knowby_name': df_completions['knowby_name'],
                'member_id': df_completions['member_id'],
                'member_name': df_completions['member_name'],
                'date': df_completions['timestamp_utc'].apply(convert_timestamp_to_date),
                'time': df_completions['timestamp_utc'].apply(convert_timestamp_to_time)
            })
            df_completions_transformed.to_csv(os.path.join(public_dir, "scrapercompletions.csv"), index=False)

        # -------------------------------
        # Enhance published knowbys with view summary
        # -------------------------------
        if df_published_clean.shape[0] > 0 and all_views:
            df_views_agg = pd.DataFrame(all_views)
            if not df_views_agg.empty:
                views_summary = df_views_agg.groupby('knowby_id').agg({
                    'timestamp_utc': ['count', 'max']
                }).reset_index()
                views_summary.columns = ['knowby_id', 'total_views', 'last_viewed_timestamp']
                views_summary['last_viewed'] = views_summary['last_viewed_timestamp'].apply(convert_timestamp_to_date)

                df_enhanced = df_published_clean.merge(
                    views_summary[['knowby_id', 'total_views', 'last_viewed']],
                    left_on='id',
                    right_on='knowby_id',
                    how='left'
                )
                df_enhanced['total_views'] = df_enhanced['total_views'].fillna(0).astype(int)
                df_enhanced['last_viewed'] = df_enhanced['last_viewed'].fillna('')

                df_final = pd.DataFrame({
                    'knowby_id': df_enhanced['id'],
                    'title': df_enhanced['title'],
                    'description': '',
                    'created_at': df_enhanced['last_updated_at_utc'].apply(convert_timestamp_to_date),
                    'created_by_member_id': df_enhanced['created_by_member_name'],
                    'member_name': df_enhanced['created_by_member_name'],
                    'status': 'Published',
                    'visibility': df_enhanced['visibility'],
                    'views': df_enhanced['total_views'],
                    'last_viewed': df_enhanced['last_viewed']
                })

                df_final.to_csv(os.path.join(public_dir, "scraperpublished.csv"), index=False)

        return True

    except Exception as e:
        print(f"Exception: {e}")
        return False


# -------------------------------
# Entry point
# -------------------------------
if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
