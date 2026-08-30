import pandas as pd
import time
from monday_api import create_board, create_column, create_item

def infer_column_type(dtype):
    if pd.api.types.is_numeric_dtype(dtype):
        return 'numbers'
    elif pd.api.types.is_datetime64_any_dtype(dtype):
        return 'date'
    return 'text'

def normalize_value(val, col_type):
    if pd.isna(val):
        return None
    if col_type == 'date':
        return val.strftime('%Y-%m-%d')
    if col_type == 'numbers':
        # Handle string currencies that might have been inferred as text originally
        if isinstance(val, str):
            val = val.replace(',', '').replace('$', '').replace('Rs.', '').strip()
            try:
                return float(val)
            except ValueError:
                return val
        return val
    # text or fallback
    return str(val).strip().title() if isinstance(val, str) else str(val)

def upload_excel_to_monday(file_path, board_name):
    print(f"Reading {file_path}...")
    
    # Use header=1 for Work Orders because row 1 is empty/metadata
    header_idx = 1 if 'Work_Order' in file_path else 0
    df = pd.read_excel(file_path, header=header_idx)
    
    print(f"Creating board '{board_name}'...")
    board = create_board(board_name)
    board_id = board.get('id')
    
    if not board_id:
        print("Failed to create board. Check your API token.")
        return
        
    print(f"Board created with ID: {board_id}")
    
    col_mapping = {} 
    item_name_col = df.columns[0]
    
    print(f"Creating columns...")
    for col in df.columns[1:]:
        col_type = infer_column_type(df[col].dtype)
        monday_type = "text"
        if col_type == 'numbers':
            monday_type = "numbers"
        elif col_type == 'date':
            monday_type = "date"
            
        print(f" - {col} ({monday_type})")
        new_col = create_column(board_id, col, monday_type)
        if new_col.get('id'):
            col_mapping[col] = {'id': new_col['id'], 'type': col_type}
            
    print("Uploading items...")
    for index, row in df.iterrows():
        item_name = str(row[item_name_col])
        if pd.isna(row[item_name_col]) or item_name.lower() == 'nan':
            item_name = f"Item {index}"
            
        column_values = {}
        for col, col_info in col_mapping.items():
            val = row[col]
            norm_val = normalize_value(val, col_info['type'])
            if norm_val is not None:
                column_values[col_info['id']] = norm_val
            
        create_item(board_id, item_name, column_values)
        
        if index > 0 and index % 10 == 0:
            print(f"Uploaded {index} items...")
            time.sleep(1) # Rate limiting
            
    print(f"Successfully uploaded {file_path} to {board_name}!")

if __name__ == "__main__":
    upload_excel_to_monday('Deal funnel Data.xlsx', 'Deals (BI Agent)')
    upload_excel_to_monday('Work_Order_Tracker Data.xlsx', 'Work Orders (BI Agent)')
