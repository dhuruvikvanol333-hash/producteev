import { Request, Response } from 'express';
import { z } from 'zod';
import { ListService } from '../services/list.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';

const createSchema = z.object({
  name: z.string().min(1),
  color: z.string().optional(),
  spaceId: z.string().uuid(),
  folderId: z.string().uuid().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().optional(),
  position: z.number().int().min(0).optional(),
  folderId: z.string().uuid().nullable().optional(),
});

const reorderSchema = z.object({
  listIds: z.array(z.string().uuid()),
});

export class ListController {
  create = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const data = createSchema.parse(req.body);
    const list = await ListService.create(data);
    res.status(201).json({ success: true, data: list });
  });

  getBySpace = asyncHandler(async (req: Request, res: Response) => {
    const lists = await ListService.getBySpace(req.params.spaceId as string);
    res.json({ success: true, data: lists });
  });

  getByFolder = asyncHandler(async (req: Request, res: Response) => {
    const lists = await ListService.getByFolder(req.params.folderId as string);
    res.json({ success: true, data: lists });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const list = await ListService.getById(req.params.id as string);
    res.json({ success: true, data: list });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const data = updateSchema.parse(req.body);
    const list = await ListService.update(req.params.id as string, data);
    res.json({ success: true, data: list });
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    await ListService.delete(req.params.id as string);
    res.json({ success: true, message: 'List deleted' });
  });

  reorder = asyncHandler(async (req: Request, res: Response) => {
    const { listIds } = reorderSchema.parse(req.body);
    await ListService.reorder(listIds);
    res.json({ success: true, message: 'Lists reordered' });
  });
}
