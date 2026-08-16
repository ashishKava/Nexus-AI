import pandas as pd
from app.schemas import WorkspaceEvent, AnalyticsReport, AnomalyDetail
from typing import List

def analyze_workspace_events(workspace_id: str, events: List[WorkspaceEvent]) -> AnalyticsReport:
    if not events:
        return AnalyticsReport(
            workspaceId=workspace_id,
            totalEvents=0,
            meanDurationMs=0.0,
            medianDurationMs=0.0,
            stdDevDurationMs=0.0,
            anomalies=[]
        )

    # 1. Convert models to list of dictionaries for Pandas DataFrame
    data = []
    for e in events:
        # Convert timestamp to naive datetime or keep as timezone-aware
        data.append({
            "eventType": e.eventType,
            "durationMs": e.durationMs,
            "timestamp": e.timestamp
        })

    df = pd.DataFrame(data)

    # 2. Compute metrics using NumPy and Pandas
    mean_val = float(df["durationMs"].mean())
    median_val = float(df["durationMs"].median())
    # ddof=0 gives the population standard deviation
    std_val = float(df["durationMs"].std(ddof=0))

    anomalies = []
    
    # 3. Detect anomalies using Z-score threshold (z > 2.0)
    # Z-score represents how many standard deviations a data point is from the mean.
    # Outliers are commonly defined as data points with |Z| > 2.0 or 3.0.
    if len(events) >= 2 and std_val > 0.0:
        z_scores = (df["durationMs"] - mean_val) / std_val
        df["zScore"] = z_scores
        
        # Filter for rows where the absolute Z-score is greater than 2
        anomalies_df = df[df["zScore"].abs() > 2.0]
        
        for _, row in anomalies_df.iterrows():
            anomalies.append(
                AnomalyDetail(
                    eventType=row["eventType"],
                    durationMs=float(row["durationMs"]),
                    timestamp=row["timestamp"],
                    zScore=float(row["zScore"])
                )
            )

    return AnalyticsReport(
        workspaceId=workspace_id,
        totalEvents=len(events),
        meanDurationMs=round(mean_val, 2),
        medianDurationMs=round(median_val, 2),
        stdDevDurationMs=round(std_val, 2),
        anomalies=anomalies
    )
