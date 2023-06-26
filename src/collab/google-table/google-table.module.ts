import { Module } from "@nestjs/common";
import { GoogleTableService } from "./google-table.service";

@Module({
  providers: [GoogleTableService],
})
export class GoogleTableModule {}
