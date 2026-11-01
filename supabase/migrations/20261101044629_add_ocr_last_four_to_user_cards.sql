/*
# Add ocr_last_four column to user_cards

## Purpose
Stores the last 4 digits extracted by in-browser OCR (Tesseract.js) from the
uploaded card photo. This allows the verification edge function to compare
the digits visible in the photo against the card_last_four recorded from the
payment gateway, instead of just checking if card_last_four is non-empty.

## Changes
- Adds `ocr_last_four` (text, nullable) column to `user_cards` table.
- No security changes needed — existing RLS policies cover the new column.

## Notes
1. The column is nullable because OCR may fail to read digits from the photo.
2. When OCR succeeds, the frontend sends the extracted last 4 digits to the
   upload-card-photo edge function, which stores them here.
3. The verify-card-ai edge function then compares ocr_last_four against
   card_last_four to determine if the photo matches the transaction card.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_cards' AND column_name = 'ocr_last_four') THEN
    ALTER TABLE user_cards ADD COLUMN ocr_last_four text;
  END IF;
END $$;
