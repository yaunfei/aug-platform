package com.aug.record.consumer;

import com.aug.record.api.RecordDetailDTO;
import com.aug.record.api.RecordFacade;
import com.aug.record.api.RecordPageDTO;
import com.aug.record.api.RecordQuery;
import com.aug.record.api.Result;
import org.apache.dubbo.config.annotation.DubboReference;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 演示端点：
 * <pre>
 *   GET /demo/records?formKey=order_form&current=1&pageSize=20&keyword=&viewKey=
 *   GET /demo/detail/{recordId}?formKey=order_form&viewKey=
 * </pre>
 * viewKey 不传 = 原样透传；传 viewKey = 下游自定义目标格式。
 */
@RestController
@RequestMapping("/demo")
public class DemoController {

    @DubboReference(check = false, timeout = 5000)
    private RecordFacade recordFacade;

    @GetMapping("/records")
    public Result<RecordPageDTO> records(@RequestParam String formKey,
                                         @RequestParam(required = false) Integer current,
                                         @RequestParam(required = false) Integer pageSize,
                                         @RequestParam(required = false) String startTime,
                                         @RequestParam(required = false) String endTime,
                                         @RequestParam(required = false) String keyword,
                                         @RequestParam(required = false) String filters,
                                         @RequestParam(required = false) String viewKey) {
        RecordQuery query = new RecordQuery();
        query.setFormKey(formKey);
        query.setCurrent(current);
        query.setPageSize(pageSize);
        query.setStartTime(startTime);
        query.setEndTime(endTime);
        query.setKeyword(keyword);
        query.setFilters(filters);
        query.setViewKey(viewKey);
        return recordFacade.listRecords(query);
    }

    @GetMapping("/detail/{recordId}")
    public Result<RecordDetailDTO> detail(@PathVariable long recordId,
                                          @RequestParam String formKey,
                                          @RequestParam(required = false) String viewKey) {
        if (viewKey == null || viewKey.trim().isEmpty()) {
            // 2 参重载：兼容老 Consumer
            return recordFacade.getDetail(formKey, recordId);
        }
        return recordFacade.getDetail(formKey, recordId, viewKey);
    }
}
