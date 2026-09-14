import { ConflictException, Injectable } from "@nestjs/common";

@Injectable()
export class AdminJobLock {
  private running = false;

  isRunning(): boolean {
    return this.running;
  }

  begin(label: string): void {
    if (this.running) {
      throw new ConflictException(`${label} is already in progress`);
    }
    this.running = true;
  }

  end(): void {
    this.running = false;
  }
}
