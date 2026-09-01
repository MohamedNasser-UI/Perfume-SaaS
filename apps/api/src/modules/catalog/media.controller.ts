import { BadRequestException, Controller, Get, NotFoundException, Param, Res } from "@nestjs/common";
import { Response } from "express";
import { existsSync } from "fs";
import path from "path";
import { Public, SkipOutlet } from "../../common/guards";
import { UPLOADS_DIR } from "../../common/uploads";

@Public()
@SkipOutlet()
@Controller("media")
export class MediaController {
  @Get("bottles/:filename")
  serve(@Param("filename") filename: string, @Res() res: Response) {
    if (!/^[a-zA-Z0-9-]+\.(jpg|png|webp|gif)$/.test(filename)) {
      throw new BadRequestException();
    }
    const filePath = path.join(UPLOADS_DIR, "bottles", filename);
    if (!existsSync(filePath)) throw new NotFoundException();
    return res.sendFile(filePath);
  }
}
