-- Change x_position and y_position from INTEGER to FLOAT
ALTER TABLE nodes 
  ALTER COLUMN x_position TYPE FLOAT USING x_position::FLOAT,
  ALTER COLUMN x_position SET DEFAULT 0;

ALTER TABLE nodes 
  ALTER COLUMN y_position TYPE FLOAT USING y_position::FLOAT,
  ALTER COLUMN y_position SET DEFAULT 0;
