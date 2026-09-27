import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MigrationService } from './migration.service';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const uri = configService.get<string>('DATABASE_URL');
        return {
          uri: uri || 'mongodb://localhost:27017/goverdhan-traders',
          serverSelectionTimeoutMS: 5000,
        };
      },
    }),
  ],
  providers: [MigrationService],
  exports: [MongooseModule, MigrationService],
})
export class DatabaseModule {}
