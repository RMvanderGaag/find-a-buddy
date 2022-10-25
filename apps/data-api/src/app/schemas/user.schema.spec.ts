import { Test } from '@nestjs/testing';

import { Model, disconnect } from 'mongoose';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { User, UserDocument, UserSchema } from "./user.schema";

describe('User Schema', () => {
  let mongod: MongoMemoryServer;
  let userModel: Model<UserDocument>;

  beforeAll(async () => {
    const app = await Test.createTestingModule({
      imports: [
        MongooseModule.forRootAsync({
          useFactory: async () => {
            mongod = await MongoMemoryServer.create();
            const uri = mongod.getUri();
            return {uri};
          },
        }),
        MongooseModule.forFeature([{ name: User.name, schema: UserSchema }])
      ],
    }).compile();

    userModel = app.get<Model<UserDocument>>(getModelToken(User.name));
  });

  afterAll(async () => {
    await disconnect();
    await mongod.stop();
  });

  it('has a required username', () => {
    const model = new userModel();

    const err = model.validateSync();

    expect(err.errors.name).toBeInstanceOf(Error);
  });

  it('has an empty list as default coach topics', () => {
    const model = new userModel();

    expect(model.coachTopics).toStrictEqual([]);
  });

  it('has an empty list as default pupil topics', () => {
    const model = new userModel();

    expect(model.pupilTopics).toStrictEqual([]);
  });

  it('has an empty list as default meetups', () => {
    const model = new userModel();

    expect(model.meetups).toStrictEqual([]);
  });
});