import { Module } from "@nestjs/common";
import { ShedulerService } from "./sheduler.service";

@Module({
  providers: [ShedulerService],
})
export class ShedulerModule {}
