import { Module } from '@nestjs/common';
import { FaceVerificationService } from './face-verification.service';

@Module({
  providers: [FaceVerificationService],
  exports: [FaceVerificationService],
})
export class FaceModule {}
