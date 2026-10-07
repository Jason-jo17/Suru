import pandas as pd

excel_file = 'ShuruKar_Bihar_Pilot_Timeline_and_Outcomes.xlsx'
sheets = pd.read_excel(excel_file, sheet_name=None)

for sheet_name, df in sheets.items():
    if sheet_name in ['Pilot timeline', 'Pilot outcome funnel', 'Growth and funding proof']:
        print(f"\n=================== Sheet: {sheet_name} ===================")
        for idx, row in df.iterrows():
            row_vals = [f"{col}: {val}" for col, val in row.items() if pd.notna(val) and str(val).strip() != '']
            if row_vals:
                print(f"Row {idx}: " + " | ".join(row_vals))
