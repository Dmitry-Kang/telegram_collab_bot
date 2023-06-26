import { Module } from "@nestjs/common";
import { TelegrafModule } from "nestjs-telegraf";
import { sessionMiddleware } from "./middleware/session.middleware";
import { CollabBotName } from "./app.constants";
import { CollabModule } from "./collab/collab.module";
import { userMiddleware } from './middleware/user.middleware';

@Module({
  imports: [
    TelegrafModule.forRootAsync({
      botName: CollabBotName,
      useFactory: () => ({
        token: process.env.BOT_TOKEN,
        middlewares: [sessionMiddleware, userMiddleware],
        include: [CollabModule],
        telegram: {
          options: {
            "parse_mode": "html",
            "username": "CollabBotName",
            "none_stop": true
          }
        }
      }),
    }),
    CollabModule,
  ],
})

export class AppModule {}
