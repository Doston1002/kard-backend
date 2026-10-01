import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-wasm';
import sharp from 'sharp';

// Node WASM build — avoids native @tensorflow/tfjs-node on Windows
// eslint-disable-next-line @typescript-eslint/no-require-imports
const faceapi = require('@vladmandic/face-api/dist/face-api.node-wasm.js');

export type FaceVerifyResult =
  | { ok: true; distance: number }
  | { ok: false; reason: 'no_face' | 'no_match' | 'no_profile' | 'error'; message: string };

@Injectable()
export class FaceVerificationService implements OnModuleInit {
  private readonly logger = new Logger(FaceVerificationService.name);
  private ready = false;
  private threshold: number;

  constructor(private configService: ConfigService) {
    this.threshold = Number(this.configService.get('FACE_MATCH_THRESHOLD') || 0.55);
  }

  async onModuleInit() {
    try {
      await tf.setBackend('wasm');
      await tf.ready();

      const modelPath = path.join(process.cwd(), 'models');
      if (!fs.existsSync(path.join(modelPath, 'ssd_mobilenetv1_model-weights_manifest.json'))) {
        this.logger.warn(`Face models not found in ${modelPath} — face verification disabled`);
        return;
      }

      await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath);
      await faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath);
      await faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath);
      this.ready = true;
      this.logger.log('Face verification models loaded (wasm)');
    } catch (err) {
      this.logger.error('Failed to load face models', err instanceof Error ? err.stack : err);
    }
  }

  isReady() {
    return this.ready;
  }

  private async bufferToTensor(buffer: Buffer): Promise<tf.Tensor3D> {
    const { data, info } = await sharp(buffer)
      .rotate()
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    return tf.tensor3d(new Uint8Array(data), [info.height, info.width, 3]);
  }

  async extractDescriptor(buffer: Buffer): Promise<Float32Array | null> {
    if (!this.ready) {
      throw new Error('Face verification models not loaded');
    }

    const tensor = await this.bufferToTensor(buffer);
    try {
      const detection = await faceapi
        .detectSingleFace(tensor)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) return null;
      return detection.descriptor as Float32Array;
    } finally {
      tensor.dispose();
    }
  }

  async verifySelfie(
    selfieBuffer: Buffer,
    profileDescriptor: number[] | undefined | null,
  ): Promise<FaceVerifyResult> {
    if (!profileDescriptor?.length) {
      return {
        ok: false,
        reason: 'no_profile',
        message: 'Admin hali profilingizga rasm yuklamagan. Kadrlar bo\'limiga murojaat qiling.',
      };
    }

    if (!this.ready) {
      return {
        ok: false,
        reason: 'error',
        message: 'Yuz tekshiruvi vaqtincha ishlamayapti. Keyinroq urinib ko\'ring.',
      };
    }

    try {
      const descriptor = await this.extractDescriptor(selfieBuffer);
      if (!descriptor) {
        return {
          ok: false,
          reason: 'no_face',
          message: 'Yuz aniqlanmadi. Iltimos, yuzingiz aniq ko\'rinadigan selfie yuboring.',
        };
      }

      const labeled = new Float32Array(profileDescriptor);
      const distance = faceapi.euclideanDistance(descriptor, labeled);

      if (distance > this.threshold) {
        return {
          ok: false,
          reason: 'no_match',
          message: 'Kechirasiz, siz bu xodim emassiz. Iltimos, yana o\'zingizning selfieni yuboring.',
        };
      }

      return { ok: true, distance };
    } catch (err) {
      this.logger.error('Face verify failed', err instanceof Error ? err.stack : err);
      return {
        ok: false,
        reason: 'error',
        message: 'Rasmni tekshirishda xatolik. Qayta yuboring.',
      };
    }
  }
}
