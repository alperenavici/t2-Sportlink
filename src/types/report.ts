// Rapor tipleri için olan tüm interface tanımlamaları 

export interface IReportCreateDTO {
    event_id: string;
    reporter_id: string;
    reported_id: string;
    report_reason: string;
    status: string;
}

export interface IReportUpdateDTO {
    status?: string;
    admin_notes?: string;
}

export interface IReportFilterOptions {
    status?: string;
    event_id?: string;
    reporter_id?: string;
    reported_id?: string;
}

// Event ve User interface'leri derleme hatalarını çözmek için
export interface IUser {
    id: string;
    username: string;
    first_name: string;
    last_name: string;
    role: string;
    profile_picture?: string;
    [key: string]: any;
}

export interface IParticipant {
    user: IUser;
    [key: string]: any;
}

export interface IEvent {
    id: string;
    creator_id: string;
    creator?: IUser;
    participants?: IParticipant[];
    sport_id: string;
    title: string;
    description: string;
    event_date: Date;
    start_time: Date;
    end_time: Date;
    location_name: string;
    location_latitude: number;
    location_longitude: number;
    max_participants: number;
    status: string;
    created_at: Date;
    updated_at: Date;
    [key: string]: any;
} 