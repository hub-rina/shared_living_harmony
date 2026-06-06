import { Module } from '@nestjs/common';
import { HarmonyService } from './harmony.service';
import { HarmonyDecayCron } from './harmony-decay.cron';

@Module({
  providers: [HarmonyService, HarmonyDecayCron],
  exports: [HarmonyService],
})
export class HarmonyModule {}
