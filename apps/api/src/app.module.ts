import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { ExpensesModule } from './expenses/expenses.module';
import { HealthController } from './health.controller';
import { HouseholdsModule } from './households/households.module';
import { LandlordModule } from './landlord/landlord.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { PrismaModule } from './prisma/prisma.module';
import { RitualsModule } from './rituals/rituals.module';
import { SuppliesModule } from './supplies/supplies.module';
import { TasksModule } from './tasks/tasks.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    ScheduleModule.forRoot(),
    PrismaModule,
    UsersModule,
    AuthModule,
    HouseholdsModule,
    TasksModule,
    LandlordModule,
    MaintenanceModule,
    RitualsModule,
    SuppliesModule,
    ExpensesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
