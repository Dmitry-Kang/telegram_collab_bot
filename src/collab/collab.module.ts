import { Module } from "@nestjs/common";
import { GoogleTableModule } from "./google-table/google-table.module";
import { ShedulerModule } from "./sheduler/sheduler.module";
import { UserModule } from "./user/user.module";

@Module({
  imports: [UserModule, ShedulerModule, GoogleTableModule],
})
export class CollabModule {}
