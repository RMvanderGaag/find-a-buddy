import { Test } from '@nestjs/testing';

import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { disconnect, Model } from 'mongoose';
import { MongoClient } from 'mongodb';

import { MeetupService } from './meetup.service';
import { User, UserDocument, UserSchema } from '../schemas/user.schema';
import { Meetup, MeetupDocument, MeetupSchema } from '../schemas/meetup.schema';
import { Topic, TopicDocument, TopicSchema } from '../schemas/topic.schema';
import { TopicService } from './topic.service';

describe('UserService', () => {
  let service: MeetupService;
  let mongod: MongoMemoryServer;
  let mongoc: MongoClient;
  let userModel: Model<UserDocument>;
  let meetupModel: Model<MeetupDocument>;
  let topicModel: Model<TopicDocument>;
  let mario, luigi, yoshi, toad, meetupA, meetupB, meetupC, topicCoins, topicTubes, topicMushrooms;

  beforeAll(async () => {
    let uri: string;
    
    const app = await Test.createTestingModule({
      imports: [
        MongooseModule.forRootAsync({
          useFactory: async () => {
            mongod = await MongoMemoryServer.create();
            uri = mongod.getUri();
            return {uri};
          },
        }),
        MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
        MongooseModule.forFeature([{ name: Meetup.name, schema: MeetupSchema }]),
        MongooseModule.forFeature([{ name: Topic.name, schema: TopicSchema }]),
      ],
      providers: [MeetupService, TopicService], // TODO are we happy with the TopicService here?
    }).compile();

    service = app.get<MeetupService>(MeetupService);

    userModel = app.get<Model<UserDocument>>(getModelToken(User.name));
    meetupModel = app.get<Model<MeetupDocument>>(getModelToken(Meetup.name));
    topicModel = app.get<Model<TopicDocument>>(getModelToken(Topic.name));

    mongoc = new MongoClient(uri);
    await mongoc.connect();
  });

  beforeEach(async () => {
    await mongoc.db('test').collection('users').deleteMany({});
    await mongoc.db('test').collection('meetups').deleteMany({});
    await mongoc.db('test').collection('topics').deleteMany({});

    topicCoins = new topicModel({title: 'coins'});
    topicTubes = new topicModel({title: 'tubes'});
    topicMushrooms = new topicModel({title: 'mushrooms'});

    mario = new userModel({name: 'mario', tutorTopics: ['coins'], pupilTopics: ['mushrooms']});
    luigi = new userModel({name: 'luigi', pupilTopics: ['coins']});
    yoshi = new userModel({name: 'yoshi', tutorTopics: ['coins'], pupilTopics: ['tubes']});
    toad = new userModel({name: 'toad', tutorTopics: ['tubes', 'mushrooms'], pupilTopics: ['coins']});

    meetupA = new meetupModel({
      tutor: mario._id,
      pupil: luigi._id,
      topic: 'coins',
      datetime: Date.now(),
    });
    meetupB = new meetupModel({
      tutor: yoshi._id,
      pupil: toad._id,
      topic: 'coins',
      datetime: Date.now(),
      accepted: true,
    });
    meetupC = new meetupModel({
      tutor: toad._id,
      pupil: yoshi._id,
      topic: 'tubes',
      datetime: Date.now(),
    });

    await Promise.all([
      mario.save(), 
      luigi.save(), 
      yoshi.save(), 
      toad.save(), 
      meetupA.save(), 
      meetupB.save(), 
      meetupC.save(), 
      topicCoins.save(),
      topicTubes.save(),
      topicMushrooms.save()
    ]);
  });

  afterAll(async () => {
    await mongoc.close();
    await disconnect();
    await mongod.stop();
  });

  describe('getInvites', () => {
    it('shows invites, not accepted meetups', async () => {
      const results = await service.getInvites(mario.id);

      expect(results).toHaveLength(1);
      expect(results[0].id).toStrictEqual(meetupA.id);
      expect(results[0]).toHaveProperty('_id', undefined);
      expect(results[0]).toHaveProperty('__v', undefined);
    });

    it('returns an empty list for non-existing user', async () => {
      const results = await service.getInvites('wrongid');

      expect(results).toStrictEqual([]);
    });
  });

  describe('create', () => {
    it('creates a meetup', async () => {
      await service.create('mushrooms', new Date(), toad.id, mario.id);

      const meetup = await meetupModel.find();

      expect(meetup.map(m => m.topic)).toContain('mushrooms');

      const updatedToad = await userModel.findOne({id: toad.id});
      const updatedMario = await userModel.findOne({id: mario.id});

      expect(updatedToad.meetups).toHaveLength(1);
      expect(updatedMario.meetups).toHaveLength(1);
    });

    it('throws when tutor user is not present', async () => {
      await expect(service.create('mushrooms', new Date(), 'invalidid', mario.id)).rejects.toThrow();
    });

    it('throws when pupil user is not present', async () => {
      await expect(service.create('mushrooms', new Date(), toad.id, 'invalidid')).rejects.toThrow();
    });

    it('throws when topic is not present for tutor', async () => {
      await expect(service.create('tubes', new Date(), luigi.id, yoshi.id)).rejects.toThrow();
    });

    it('throws when topic is not present for pupil', async () => {
      await expect(service.create('mushrooms', new Date(), toad.id, luigi.id)).rejects.toThrow();
    });
  });
  
  describe('getAll', () => {
    it('shows all meetups where you are a pupil and accepted meetings where you are tutor', async () => {
      const results = await service.getAll(yoshi.id);
      
      expect(results).toHaveLength(2);
      expect(results.map(m => m.id)).toContain(meetupB.id);
      expect(results.map(m => m.id)).toContain(meetupC.id);
    });
    
    it('returns an empty list for non-existing user', async () => {
      const results = await service.getAll('wrongid');
      
      expect(results).toStrictEqual([]);
    });
  });

  describe('getOne', () => {
    it('retrieves one meetup where you are pupil', async () => {
      const result = await service.getOne(luigi.id, meetupA.id);
      
      expect(result).toHaveProperty('id', meetupA.id);
    });

    it('retrieves one accepted meetup where you are tutor', async () => {
      const result = await service.getOne(yoshi.id, meetupB.id);
      
      expect(result).toHaveProperty('id', meetupB.id);
    });

    it('retrieves one unaccepted meetup where you are tutor', async () => {
      const result = await service.getOne(toad.id, meetupC.id);
      
      expect(result).toHaveProperty('id', meetupC.id);
    });

    it('does not retrieve a meetup you are not involved in', async () => {
      const result = await service.getOne(yoshi.id, meetupA.id);
      
      expect(result).toStrictEqual(null);
    });

    it('does not retrieve a meetup for non-exisiting user', async () => {
      const result = await service.getOne('wrongid', meetupA.id);
      
      expect(result).toStrictEqual(null);
    });
  });

  describe('postReview', () => {
    it('posts a new review', async () => {
      await service.postReview(toad.id, meetupB.id, 'Yoshi is great!', 5);

      const meetup = await meetupModel.findOne({id: meetupB.id});
      expect(meetup).toHaveProperty('review');
      expect(meetup).toHaveProperty('review.text', 'Yoshi is great!');
      expect(meetup).toHaveProperty('review.rating', 5);
    });

    it('does not post if review is invalid', async () => {
      await expect(service.postReview(toad.id, meetupB.id, 'Yoshi is aweful!', 0)).rejects.toThrow();
    });

    it('does not post if user is not pupil', async () => {
      await expect(service.postReview(yoshi.id, meetupB.id, 'Yoshi is amazing!', 5)).rejects.toThrow();
    });

    it('does not post if a review already exists', async () => {
      const meetup = await meetupModel.findOne({id: meetupB.id});
      meetup.review = {
        text: 'Yoshi is amazing!',
        rating: 5,
      };
      await meetup.save();

      await expect(service.postReview(toad.id, meetupB.id, 'Yoshi is amazing!', 5)).rejects.toThrow();
    });
  });
});
