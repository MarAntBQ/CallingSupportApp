ALTER TABLE "users" ADD COLUMN "telegram_chat_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "telegram_link_code" text;--> statement-breakpoint
ALTER TABLE "app_config" ADD COLUMN "telegram_bot_token_enc" text;--> statement-breakpoint
ALTER TABLE "app_config" ADD COLUMN "telegram_bot_username" text;--> statement-breakpoint
ALTER TABLE "app_config" ADD COLUMN "telegram_webhook_secret_enc" text;