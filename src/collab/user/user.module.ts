import { Module } from "@nestjs/common";
import { UserService } from "./user.service";
import { UserController } from "./user.controller";
import { AddTwitterScene } from "./scenes/add-twitter.scene";
import { GetTopScene } from "./scenes/get-top.scene";
import { GetNewScene } from "./scenes/get-new.scene";
import { GetMyScene } from "./scenes/get-my.scene";
import { GetManagersScene } from "./scenes/get-managers.scene";
import { FindScene } from "./scenes/find.scene";

@Module({
//   controllers: [UserController],
  providers: [UserController, AddTwitterScene, GetTopScene, GetNewScene, GetMyScene, GetManagersScene, FindScene],
})
export class UserModule {}
