package com.aug.record.consumer;

import com.aug.record.api.RecordPageDTO;
import com.aug.record.api.Result;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 端到端冒烟：需要 ZooKeeper + Provider + 已发布 schema 数据。
 *
 * <p>不纳入默认 mvn test（类名 *IT 不被 surefire 收集）。显式执行：
 * <pre>
 *   RUN_DUBBO_IT=true mvn -pl record-consumer-demo test -Dtest=RecordFacadeSmokeIT
 * </pre>
 * 若 Provider 注册到不可达虚拟网卡，重启 Provider 时设置
 * {@code DUBBO_IP_TO_REGISTRY=<真实网卡IP>}（逃生舱，勿写 loopback）。</p>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@EnabledIfEnvironmentVariable(named = "RUN_DUBBO_IT", matches = "true")
class RecordFacadeSmokeIT {

    @Autowired
    private DemoController demoController;

    @Test
    void listRecordsThroughDubbo() {
        Result<RecordPageDTO> result = demoController.records(
                "order_form", 1, 10, null, null, null, null, null);
        assertTrue(result.isSuccess(), String.valueOf(result.getErrorMessage()));
        assertNotNull(result.getData());
    }
}
