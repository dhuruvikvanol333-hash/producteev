import { Request, Response } from 'express';
import { z } from 'zod';
import { FolderService } from '../services/folder.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';

const createSchema = z.object({
  name: z.string().min(1),
  color: z.string().optional(),
  spaceId: z.string().uuid(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().optional(),
  position: z.number().int().min(0).optional(),
});

const reorderSchema = z.object({
  folderIds: z.array(z.string().uuid()),
});

export class FolderController {
  create = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const data = createSchema.parse(req.body);
    const folder = await FolderService.create(data);
    res.status(201).json({ success: true, data: folder });
  });

  getBySpace = asyncHandler(async (req: Request, res: Response) => {
    const folders = await FolderService.getBySpace(req.params.spaceId as string);
    res.json({ success: true, data: folders });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const folder = await FolderService.getById(req.params.id as string);
    res.json({ success: true, data: folder });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const data = updateSchema.parse(req.body);
    const folder = await FolderService.update(req.params.id as string, data);
    res.json({ success: true, data: folder });
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    await FolderService.delete(req.params.id as string);
    res.json({ success: true, message: 'Folder deleted' });
  });

  reorder = asyncHandler(async (req: Request, res: Response) => {
    const { folderIds } = reorderSchema.parse(req.body);
    await FolderService.reorder(req.params.spaceId as string, folderIds);
    res.json({ success: true, message: 'Folders reordered' });
  });
}
