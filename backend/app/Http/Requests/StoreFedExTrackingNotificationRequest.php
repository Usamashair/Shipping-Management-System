<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreFedExTrackingNotificationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'senderContactName' => ['required', 'string', 'max:255'],
            'senderEMailAddress' => ['required', 'email', 'max:255'],
            'trackingEventNotificationDetail' => ['required', 'array'],
            'trackingEventNotificationDetail.trackingNotifications' => ['required', 'array', 'min:1'],
            'trackingEventNotificationDetail.trackingNotifications.*.notificationDetail' => ['required', 'array'],
            'trackingEventNotificationDetail.trackingNotifications.*.notificationDetail.localization' => ['required', 'array'],
            'trackingEventNotificationDetail.trackingNotifications.*.notificationDetail.localization.languageCode' => ['required', 'string', 'max:16'],
            'trackingEventNotificationDetail.trackingNotifications.*.notificationDetail.localization.localeCode' => ['nullable', 'string', 'max:16'],
            'trackingEventNotificationDetail.trackingNotifications.*.notificationDetail.emailDetail' => ['required', 'array'],
            'trackingEventNotificationDetail.trackingNotifications.*.notificationDetail.emailDetail.emailAddress' => ['required', 'email', 'max:255'],
            'trackingEventNotificationDetail.trackingNotifications.*.notificationDetail.emailDetail.name' => ['nullable', 'string', 'max:255'],
            'trackingEventNotificationDetail.trackingNotifications.*.notificationDetail.notificationType' => ['required', 'string', 'in:HTML,TEXT'],
            'trackingEventNotificationDetail.trackingNotifications.*.role' => ['nullable', 'string', 'in:BROKER,OTHER,RECIPIENT,SHIPPER'],
            'trackingEventNotificationDetail.trackingNotifications.*.notificationEventTypes' => ['required', 'array', 'min:1'],
            'trackingEventNotificationDetail.trackingNotifications.*.notificationEventTypes.*' => ['string', 'in:ON_DELIVERY,ON_ESTIMATED_DELIVERY,ON_EXCEPTION,ON_TENDER'],
            'trackingEventNotificationDetail.trackingNotifications.*.currentResultRequestedFlag' => ['nullable', 'boolean'],
            'trackingEventNotificationDetail.personalMessage' => ['nullable', 'string'],
            'trackingEventNotificationDetail.supportHTML' => ['nullable'],
            'trackingNumberInfo' => ['required', 'array'],
            'trackingNumberInfo.trackingNumber' => ['required', 'string', 'max:64'],
            'trackingNumberInfo.carrierCode' => ['nullable', 'string', 'max:64'],
            'trackingNumberInfo.trackingNumberUniqueId' => ['nullable', 'string', 'max:255'],
            'shipDateBegin' => ['nullable', 'date_format:Y-m-d'],
            'shipDateEnd' => ['nullable', 'date_format:Y-m-d'],
        ];
    }
}
